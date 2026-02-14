/**
 * =============================================================================
 * USER DASHBOARD CONTROLLER
 * =============================================================================
 * Provides user dashboard data and activity overview
 * 
 * Features:
 * - Dashboard overview with stats
 * - Registered competitions list
 * - Activity timeline
 * - Upcoming deadlines
 * - Profile completion status
 * =============================================================================
 */

const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Competition = require('../models/Competition');
const User = require('../models/UserSchema');
const { getPagination, formatPagination } = require('../middleware/validators');

// =============================================================================
// GET DASHBOARD OVERVIEW
// =============================================================================

/**
 * @desc    Get user dashboard overview with stats and summaries
 * @route   GET /api/dashboard
 * @access  Private
 */
const getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data
    const user = await User.findById(userId)
      .select('name email role createdAt lastLogin')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get registration stats
    const registrationStats = await Registration.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format stats
    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      completed: 0
    };

    registrationStats.forEach(stat => {
      stats[stat._id] = stat.count;
      stats.total += stat.count;
    });

    // Get upcoming competitions (approved registrations)
    const upcomingCompetitions = await Registration.find({
      user: userId,
      status: 'approved'
    })
      .populate({
        path: 'competition',
        match: { 
          startDate: { $gte: new Date() },
          isDeleted: false 
        },
        select: 'title slug startDate endDate deadline thumbnail'
      })
      .select('confirmationCode createdAt')
      .sort({ 'competition.startDate': 1 })
      .limit(5)
      .lean();

    // Filter out null competitions (past ones)
    const upcoming = upcomingCompetitions
      .filter(reg => reg.competition)
      .map(reg => ({
        registrationId: reg._id,
        confirmationCode: reg.confirmationCode,
        registeredAt: reg.createdAt,
        competition: reg.competition
      }));

    // Get recent activity
    const recentActivity = await Registration.find({ user: userId })
      .populate({
        path: 'competition',
        select: 'title slug'
      })
      .select('status createdAt updatedAt confirmationCode')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    const activity = recentActivity.map(reg => ({
      id: reg._id,
      type: 'registration',
      status: reg.status,
      competition: reg.competition,
      confirmationCode: reg.confirmationCode,
      date: reg.updatedAt || reg.createdAt
    }));

    // Calculate profile completion
    const profileCompletion = calculateProfileCompletion(user);

    // Get upcoming deadlines
    const upcomingDeadlines = await getUpcomingDeadlines(userId);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
          memberSince: user.createdAt,
          lastLogin: user.lastLogin
        },
        stats,
        upcomingCompetitions: upcoming,
        recentActivity: activity,
        upcomingDeadlines,
        profileCompletion
      }
    });

  } catch (error) {
    console.error('Dashboard overview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET MY COMPETITIONS
// =============================================================================

/**
 * @desc    Get all competitions user is registered for
 * @route   GET /api/dashboard/competitions
 * @access  Private
 */
const getMyCompetitions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 10 });
    const { status, timeframe } = req.query;

    // Build filter
    const filter = { user: userId };
    if (status) {
      filter.status = status;
    }

    // Build competition time filter
    let competitionFilter = { isDeleted: false };
    const now = new Date();

    if (timeframe === 'upcoming') {
      competitionFilter.startDate = { $gte: now };
    } else if (timeframe === 'ongoing') {
      competitionFilter.startDate = { $lte: now };
      competitionFilter.endDate = { $gte: now };
    } else if (timeframe === 'past') {
      competitionFilter.endDate = { $lt: now };
    }

    const [registrations, total] = await Promise.all([
      Registration.find(filter)
        .populate({
          path: 'competition',
          match: competitionFilter,
          select: 'title slug shortDescription startDate endDate deadline status category thumbnail prizes'
        })
        .populate({
          path: 'competition',
          populate: {
            path: 'category',
            select: 'name slug icon'
          }
        })
        .select('status confirmationCode teamName createdAt submission')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Registration.countDocuments(filter)
    ]);

    // Filter out null competitions (didn't match time filter)
    const competitions = registrations
      .filter(reg => reg.competition)
      .map(reg => ({
        registrationId: reg._id,
        confirmationCode: reg.confirmationCode,
        registrationStatus: reg.status,
        teamName: reg.teamName,
        registeredAt: reg.createdAt,
        hasSubmission: !!reg.submission?.submittedAt,
        competition: reg.competition
      }));

    return res.status(200).json({
      success: true,
      data: {
        competitions,
        pagination: formatPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get my competitions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch competitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET ACTIVITY TIMELINE
// =============================================================================

/**
 * @desc    Get user activity timeline
 * @route   GET /api/dashboard/activity
 * @access  Private
 */
const getActivityTimeline = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20 });

    const [activities, total] = await Promise.all([
      Registration.find({ user: userId })
        .populate({
          path: 'competition',
          select: 'title slug'
        })
        .select('status confirmationCode createdAt updatedAt reviewedAt submission')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Registration.countDocuments({ user: userId })
    ]);

    // Transform into activity events
    const timeline = [];
    
    activities.forEach(reg => {
      // Registration created event
      timeline.push({
        id: `${reg._id}-created`,
        type: 'registration_created',
        message: `Registered for ${reg.competition?.title || 'competition'}`,
        competition: reg.competition,
        confirmationCode: reg.confirmationCode,
        date: reg.createdAt
      });

      // Status change events
      if (reg.status === 'approved' && reg.reviewedAt) {
        timeline.push({
          id: `${reg._id}-approved`,
          type: 'registration_approved',
          message: `Registration approved for ${reg.competition?.title || 'competition'}`,
          competition: reg.competition,
          date: reg.reviewedAt
        });
      }

      if (reg.status === 'rejected' && reg.reviewedAt) {
        timeline.push({
          id: `${reg._id}-rejected`,
          type: 'registration_rejected',
          message: `Registration rejected for ${reg.competition?.title || 'competition'}`,
          competition: reg.competition,
          date: reg.reviewedAt
        });
      }

      // Submission event
      if (reg.submission?.submittedAt) {
        timeline.push({
          id: `${reg._id}-submitted`,
          type: 'project_submitted',
          message: `Project submitted for ${reg.competition?.title || 'competition'}`,
          competition: reg.competition,
          date: reg.submission.submittedAt
        });
      }
    });

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Paginate timeline
    const paginatedTimeline = timeline.slice(0, limit);

    return res.status(200).json({
      success: true,
      data: {
        timeline: paginatedTimeline,
        pagination: formatPagination(timeline.length, page, limit)
      }
    });

  } catch (error) {
    console.error('Get activity timeline error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity timeline',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET UPCOMING DEADLINES
// =============================================================================

/**
 * @desc    Get upcoming deadlines for registered competitions
 * @route   GET /api/dashboard/deadlines
 * @access  Private
 */
const getDeadlines = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const deadlines = await getUpcomingDeadlines(userId, parseInt(limit));

    return res.status(200).json({
      success: true,
      data: deadlines
    });

  } catch (error) {
    console.error('Get deadlines error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch deadlines',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET DASHBOARD STATS
// =============================================================================

/**
 * @desc    Get detailed stats for dashboard widgets
 * @route   GET /api/dashboard/stats
 * @access  Private
 */
const getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Registration stats by status
    const registrationStats = await Registration.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Monthly registration trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await Registration.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Category distribution
    const categoryDistribution = await Registration.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'competitions',
          localField: 'competition',
          foreignField: '_id',
          as: 'comp'
        }
      },
      { $unwind: '$comp' },
      {
        $lookup: {
          from: 'categories',
          localField: 'comp.category',
          foreignField: '_id',
          as: 'cat'
        }
      },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { id: '$cat._id', name: '$cat.name', icon: '$cat.icon' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format stats
    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      completed: 0
    };

    registrationStats.forEach(stat => {
      stats[stat._id] = stat.count;
      stats.total += stat.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        registrations: stats,
        monthlyTrend: monthlyTrend.map(item => ({
          year: item._id.year,
          month: item._id.month,
          count: item.count
        })),
        categoryDistribution: categoryDistribution.map(item => ({
          category: item._id,
          count: item.count
        }))
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate profile completion percentage
 */
function calculateProfileCompletion(user) {
  const fields = {
    name: !!user.name,
    email: !!user.email,
    // Add more fields as profile expands
  };

  const completed = Object.values(fields).filter(Boolean).length;
  const total = Object.keys(fields).length;
  const percentage = Math.round((completed / total) * 100);

  return {
    percentage,
    completed,
    total,
    fields
  };
}

/**
 * Get upcoming deadlines for user's registered competitions
 */
async function getUpcomingDeadlines(userId, limit = 10) {
  const now = new Date();

  const registrations = await Registration.find({
    user: userId,
    status: { $in: ['pending', 'approved'] }
  })
    .populate({
      path: 'competition',
      match: {
        isDeleted: false,
        $or: [
          { deadline: { $gte: now } },
          { startDate: { $gte: now } },
          { endDate: { $gte: now } }
        ]
      },
      select: 'title slug deadline startDate endDate'
    })
    .select('status confirmationCode')
    .lean();

  const deadlines = [];

  registrations.forEach(reg => {
    if (!reg.competition) return;

    const comp = reg.competition;

    // Registration deadline
    if (comp.deadline && new Date(comp.deadline) >= now) {
      deadlines.push({
        id: `${reg._id}-deadline`,
        type: 'registration_deadline',
        title: `Registration Deadline: ${comp.title}`,
        competition: { id: comp._id, title: comp.title, slug: comp.slug },
        date: comp.deadline,
        daysRemaining: Math.ceil((new Date(comp.deadline) - now) / (1000 * 60 * 60 * 24))
      });
    }

    // Start date
    if (comp.startDate && new Date(comp.startDate) >= now) {
      deadlines.push({
        id: `${reg._id}-start`,
        type: 'competition_start',
        title: `Competition Starts: ${comp.title}`,
        competition: { id: comp._id, title: comp.title, slug: comp.slug },
        date: comp.startDate,
        daysRemaining: Math.ceil((new Date(comp.startDate) - now) / (1000 * 60 * 60 * 24))
      });
    }

    // End date
    if (comp.endDate && new Date(comp.endDate) >= now) {
      deadlines.push({
        id: `${reg._id}-end`,
        type: 'competition_end',
        title: `Competition Ends: ${comp.title}`,
        competition: { id: comp._id, title: comp.title, slug: comp.slug },
        date: comp.endDate,
        daysRemaining: Math.ceil((new Date(comp.endDate) - now) / (1000 * 60 * 60 * 24))
      });
    }
  });

  // Sort by date
  deadlines.sort((a, b) => new Date(a.date) - new Date(b.date));

  return deadlines.slice(0, limit);
}

module.exports = {
  getDashboardOverview,
  getMyCompetitions,
  getActivityTimeline,
  getDeadlines,
  getStats
};
