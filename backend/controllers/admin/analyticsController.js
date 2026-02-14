/**
 * =============================================================================
 * ADMIN ANALYTICS CONTROLLER
 * =============================================================================
 * Dashboard analytics and statistics for admins
 * 
 * Features:
 * - User statistics and growth
 * - Competition analytics
 * - Registration trends
 * - Category performance
 * - Activity logs
 * =============================================================================
 */

const mongoose = require('mongoose');
const User = require('../../models/UserSchema');
const Competition = require('../../models/Competition');
const Registration = require('../../models/Registration');
const Category = require('../../models/Category');
const cacheService = require('../../config/cache');

// Cache keys and TTLs
const CACHE_KEY = 'admin:analytics:dashboard';
const CACHE_TTL = 300; // 5 minutes

// =============================================================================
// DASHBOARD OVERVIEW
// =============================================================================

/**
 * @desc    Get dashboard overview statistics
 * @route   GET /api/admin/analytics/dashboard
 * @access  Admin
 */
const getDashboardStats = async (req, res) => {
  try {
    // Try to get from cache first
    const cached = await cacheService.get(CACHE_KEY);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parallel fetch all statistics
    const [
      userStats,
      competitionStats,
      registrationStats,
      categoryStats,
      recentRegistrations,
      topCompetitions
    ] = await Promise.all([
      // User statistics
      User.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            active: [
              { $match: { isActive: true } },
              { $count: 'count' }
            ],
            byRole: [
              { $group: { _id: '$role', count: { $sum: 1 } } }
            ],
            newThisMonth: [
              { $match: { createdAt: { $gte: thirtyDaysAgo } } },
              { $count: 'count' }
            ],
            newThisWeek: [
              { $match: { createdAt: { $gte: sevenDaysAgo } } },
              { $count: 'count' }
            ]
          }
        }
      ]),

      // Competition statistics
      Competition.aggregate([
        { $match: { isDeleted: false } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } }
            ],
            active: [
              {
                $match: {
                  status: 'published',
                  deadline: { $gte: now }
                }
              },
              { $count: 'count' }
            ],
            totalViews: [
              { $group: { _id: null, total: { $sum: '$viewsCount' } } }
            ],
            totalRegistrations: [
              { $group: { _id: null, total: { $sum: '$registrationsCount' } } }
            ]
          }
        }
      ]),

      // Registration statistics
      Registration.getOverallStats(),

      // Category statistics
      Category.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            active: [
              { $match: { isActive: true } },
              { $count: 'count' }
            ],
            withCompetitions: [
              { $match: { competitionsCount: { $gt: 0 } } },
              { $count: 'count' }
            ]
          }
        }
      ]),

      // Recent registrations (last 5)
      Registration.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name email avatar')
        .populate('competition', 'title slug')
        .select('status confirmationCode createdAt')
        .lean(),

      // Top performing competitions
      Competition.find({
        isDeleted: false,
        status: 'published'
      })
        .sort({ registrationsCount: -1 })
        .limit(5)
        .select('title slug registrationsCount viewsCount deadline')
        .lean()
    ]);

    // Format response
    const stats = {
      users: {
        total: userStats[0].total[0]?.count || 0,
        active: userStats[0].active[0]?.count || 0,
        byRole: userStats[0].byRole.reduce((acc, r) => {
          acc[r._id] = r.count;
          return acc;
        }, {}),
        newThisMonth: userStats[0].newThisMonth[0]?.count || 0,
        newThisWeek: userStats[0].newThisWeek[0]?.count || 0
      },
      competitions: {
        total: competitionStats[0].total[0]?.count || 0,
        byStatus: competitionStats[0].byStatus.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
        active: competitionStats[0].active[0]?.count || 0,
        totalViews: competitionStats[0].totalViews[0]?.total || 0,
        totalRegistrations: competitionStats[0].totalRegistrations[0]?.total || 0
      },
      registrations: registrationStats,
      categories: {
        total: categoryStats[0].total[0]?.count || 0,
        active: categoryStats[0].active[0]?.count || 0,
        withCompetitions: categoryStats[0].withCompetitions[0]?.count || 0
      },
      recentRegistrations,
      topCompetitions
    };

    // Cache the results
    await cacheService.set(CACHE_KEY, stats, CACHE_TTL);

    return res.status(200).json({
      success: true,
      data: stats,
      cached: false
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// USER GROWTH CHART DATA
// =============================================================================

/**
 * @desc    Get user growth data for charts
 * @route   GET /api/admin/analytics/users/growth
 * @access  Admin
 */
const getUserGrowth = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    let startDate;
    let groupFormat;
    
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m-%d';
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m-%d';
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%W'; // Weekly
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m'; // Monthly
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m-%d';
    }

    const growth = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          newUsers: '$count',
          _id: 0
        }
      }
    ]);

    // Calculate cumulative growth
    let cumulative = 0;
    const cumulativeGrowth = growth.map(item => {
      cumulative += item.newUsers;
      return {
        ...item,
        totalUsers: cumulative
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        period,
        growth: cumulativeGrowth
      }
    });

  } catch (error) {
    console.error('User growth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user growth data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// REGISTRATION TRENDS
// =============================================================================

/**
 * @desc    Get registration trends for charts
 * @route   GET /api/admin/analytics/registrations/trends
 * @access  Admin
 */
const getRegistrationTrends = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let startDate;
    let groupFormat;
    
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m-%d';
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m-%d';
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%W';
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m-%d';
    }

    const [trends, statusBreakdown] = await Promise.all([
      Registration.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            total: { $sum: 1 },
            approved: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            total: 1,
            approved: 1,
            pending: 1,
            rejected: 1,
            _id: 0
          }
        }
      ]),
      Registration.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        period,
        trends,
        statusBreakdown: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Registration trends error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch registration trends',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// CATEGORY PERFORMANCE
// =============================================================================

/**
 * @desc    Get category performance analytics
 * @route   GET /api/admin/analytics/categories/performance
 * @access  Admin
 */
const getCategoryPerformance = async (req, res) => {
  try {
    const performance = await Category.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'competitions',
          localField: '_id',
          foreignField: 'category',
          as: 'competitions'
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          color: 1,
          competitionsCount: { $size: '$competitions' },
          totalRegistrations: { $sum: '$competitions.registrationsCount' },
          totalViews: { $sum: '$competitions.viewsCount' },
          activeCompetitions: {
            $size: {
              $filter: {
                input: '$competitions',
                as: 'comp',
                cond: {
                  $and: [
                    { $eq: ['$$comp.status', 'published'] },
                    { $gte: ['$$comp.deadline', new Date()] }
                  ]
                }
              }
            }
          }
        }
      },
      { $sort: { totalRegistrations: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      data: performance
    });

  } catch (error) {
    console.error('Category performance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch category performance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// COMPETITION ANALYTICS
// =============================================================================

/**
 * @desc    Get competition analytics
 * @route   GET /api/admin/analytics/competitions
 * @access  Admin
 */
const getCompetitionAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const [overview, topByRegistrations, topByViews, upcomingDeadlines] = await Promise.all([
      Competition.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            totalCompetitions: { $sum: 1 },
            totalRegistrations: { $sum: '$registrationsCount' },
            totalViews: { $sum: '$viewsCount' },
            avgRegistrations: { $avg: '$registrationsCount' },
            avgViews: { $avg: '$viewsCount' }
          }
        }
      ]),
      Competition.find({ isDeleted: false, status: 'published' })
        .sort({ registrationsCount: -1 })
        .limit(10)
        .select('title slug registrationsCount category')
        .populate('category', 'name color')
        .lean(),
      Competition.find({ isDeleted: false, status: 'published' })
        .sort({ viewsCount: -1 })
        .limit(10)
        .select('title slug viewsCount category')
        .populate('category', 'name color')
        .lean(),
      Competition.find({
        isDeleted: false,
        status: 'published',
        deadline: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      })
        .sort({ deadline: 1 })
        .limit(5)
        .select('title slug deadline registrationsCount')
        .lean()
    ]);

    return res.status(200).json({
      success: true,
      data: {
        overview: overview[0] || {},
        topByRegistrations,
        topByViews,
        upcomingDeadlines
      }
    });

  } catch (error) {
    console.error('Competition analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch competition analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// REAL-TIME STATS (For live dashboard)
// =============================================================================

/**
 * @desc    Get real-time statistics (minimal caching)
 * @route   GET /api/admin/analytics/realtime
 * @access  Admin
 */
const getRealtimeStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    const [todayRegistrations, todayUsers, pendingRegistrations, activeCompetitions] = await Promise.all([
      Registration.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      Registration.countDocuments({ status: 'pending' }),
      Competition.countDocuments({
        isDeleted: false,
        status: 'published',
        deadline: { $gte: new Date() }
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        todayRegistrations,
        todayUsers,
        pendingRegistrations,
        activeCompetitions,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Realtime stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch realtime stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getDashboardStats,
  getUserGrowth,
  getRegistrationTrends,
  getCategoryPerformance,
  getCompetitionAnalytics,
  getRealtimeStats
};
