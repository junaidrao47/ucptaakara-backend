/**
 * =============================================================================
 * SUPPORT CONTROLLER
 * =============================================================================
 * Endpoints for support staff
 * 
 * Features:
 * - View pending registrations
 * - Approve/reject registrations
 * - User assistance queries
 * - Basic competition viewing
 * =============================================================================
 */

const Registration = require('../models/Registration');
const Competition = require('../models/Competition');
const User = require('../models/UserSchema');
const { getPagination, formatPagination } = require('../middleware/validators');

// =============================================================================
// GET PENDING REGISTRATIONS
// =============================================================================

/**
 * @desc    Get pending registrations for review
 * @route   GET /api/support/registrations/pending
 * @access  Support
 */
const getPendingRegistrations = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20 });
    const { search, competition } = req.query;

    const filter = { status: 'pending' };
    if (competition) filter.competition = competition;

    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      {
        $lookup: {
          from: 'competitions',
          localField: 'competition',
          foreignField: '_id',
          as: 'competitionDetails'
        }
      },
      { $unwind: '$competitionDetails' }
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'userDetails.name': { $regex: search, $options: 'i' } },
            { 'userDetails.email': { $regex: search, $options: 'i' } },
            { 'competitionDetails.title': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Get count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const [countResult] = await Registration.aggregate(countPipeline);
    const total = countResult?.total || 0;

    // Add pagination and projection
    pipeline.push(
      { $sort: { createdAt: 1 } }, // Oldest first for FIFO processing
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          confirmationCode: 1,
          teamName: 1,
          institution: 1,
          phone: 1,
          createdAt: 1,
          'user._id': '$userDetails._id',
          'user.name': '$userDetails.name',
          'user.email': '$userDetails.email',
          'competition._id': '$competitionDetails._id',
          'competition.title': '$competitionDetails.title',
          'competition.deadline': '$competitionDetails.deadline'
        }
      }
    );

    const registrations = await Registration.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      data: {
        registrations,
        pagination: formatPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get pending registrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending registrations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// APPROVE REGISTRATION
// =============================================================================

/**
 * @desc    Approve a pending registration
 * @route   PATCH /api/support/registrations/:id/approve
 * @access  Support
 */
const approveRegistration = async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findById(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve registration with status: ${registration.status}`
      });
    }

    const updated = await Registration.approve(id, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Registration approved successfully',
      data: updated
    });

  } catch (error) {
    console.error('Approve registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// REJECT REGISTRATION
// =============================================================================

/**
 * @desc    Reject a pending registration
 * @route   PATCH /api/support/registrations/:id/reject
 * @access  Support
 */
const rejectRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const registration = await Registration.findById(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject registration with status: ${registration.status}`
      });
    }

    const updated = await Registration.reject(id, req.user.id, reason);
    await Competition.updateRegistrationCount(registration.competition, -1);

    return res.status(200).json({
      success: true,
      message: 'Registration rejected successfully',
      data: updated
    });

  } catch (error) {
    console.error('Reject registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// SEARCH USER
// =============================================================================

/**
 * @desc    Search for users (for support queries)
 * @route   GET /api/support/users/search
 * @access  Support
 */
const searchUsers = async (req, res) => {
  try {
    const { q, page, limit } = req.query;
    const { skip } = getPagination({ page, limit }, { page: 1, limit: 20 });

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const filter = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email role isActive createdAt')
        .skip(skip)
        .limit(parseInt(limit) || 20)
        .lean(),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: formatPagination(total, parseInt(page) || 1, parseInt(limit) || 20)
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET USER REGISTRATIONS (for support)
// =============================================================================

/**
 * @desc    Get a user's registrations for support
 * @route   GET /api/support/users/:userId/registrations
 * @access  Support
 */
const getUserRegistrations = async (req, res) => {
  try {
    const { userId } = req.params;

    const registrations = await Registration.find({ user: userId })
      .populate({
        path: 'competition',
        select: 'title slug deadline category'
      })
      .select('status confirmationCode teamName createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: registrations
    });

  } catch (error) {
    console.error('Get user registrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user registrations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET SUPPORT DASHBOARD STATS
// =============================================================================

/**
 * @desc    Get support dashboard stats
 * @route   GET /api/support/dashboard
 * @access  Support
 */
const getDashboardStats = async (req, res) => {
  try {
    const [pendingCount, todayRegistrations, activeCompetitions] = await Promise.all([
      Registration.countDocuments({ status: 'pending' }),
      Registration.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      Competition.countDocuments({
        isDeleted: false,
        status: 'published',
        deadline: { $gte: new Date() }
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        pendingRegistrations: pendingCount,
        todayRegistrations,
        activeCompetitions
      }
    });

  } catch (error) {
    console.error('Support dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  searchUsers,
  getUserRegistrations,
  getDashboardStats
};
