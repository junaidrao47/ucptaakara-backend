/**
 * =============================================================================
 * ADMIN REGISTRATION CONTROLLER
 * =============================================================================
 * Handles registration management for admins
 * - Approve/Reject registrations
 * - View all registrations
 * - Bulk operations
 * =============================================================================
 */

const mongoose = require('mongoose');
const Registration = require('../../models/Registration');
const Competition = require('../../models/Competition');
const { getPagination, formatPagination } = require('../../middleware/validators');

// =============================================================================
// GET ALL REGISTRATIONS
// =============================================================================

/**
 * @desc    Get all registrations across all competitions
 * @route   GET /api/admin/registrations
 * @access  Admin
 */
const getAllRegistrations = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20 });
    const { status, competition, search } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (competition) filter.competition = competition;

    // Build aggregation pipeline
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

    // Add search if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'userDetails.name': { $regex: search, $options: 'i' } },
            { 'userDetails.email': { $regex: search, $options: 'i' } },
            { 'competitionDetails.title': { $regex: search, $options: 'i' } },
            { confirmationCode: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Get count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const [countResult] = await Registration.aggregate(countPipeline);
    const total = countResult?.total || 0;

    // Add sort, skip, limit, and projection
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          status: 1,
          teamName: 1,
          confirmationCode: 1,
          createdAt: 1,
          'user._id': '$userDetails._id',
          'user.name': '$userDetails.name',
          'user.email': '$userDetails.email',
          'competition._id': '$competitionDetails._id',
          'competition.title': '$competitionDetails.title',
          'competition.slug': '$competitionDetails.slug'
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
    console.error('Get all registrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET REGISTRATION BY ID
// =============================================================================

/**
 * @desc    Get registration details
 * @route   GET /api/admin/registrations/:id
 * @access  Admin
 */
const getRegistrationById = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id)
      .populate('user', 'name email avatar')
      .populate({
        path: 'competition',
        select: 'title slug deadline category type',
        populate: {
          path: 'category',
          select: 'name slug'
        }
      })
      .populate('processedBy', 'name email')
      .lean();

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: registration
    });

  } catch (error) {
    console.error('Get registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// APPROVE REGISTRATION
// =============================================================================

/**
 * @desc    Approve a pending registration
 * @route   PATCH /api/admin/registrations/:id/approve
 * @access  Admin
 */
const approveRegistration = async (req, res) => {
  try {
    const registrationId = req.params.id;

    const registration = await Registration.findById(registrationId);
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

    // Approve registration
    const updated = await Registration.approve(registrationId, req.user.id);

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
 * @route   PATCH /api/admin/registrations/:id/reject
 * @access  Admin
 */
const rejectRegistration = async (req, res) => {
  try {
    const registrationId = req.params.id;
    const { reason } = req.body;

    const registration = await Registration.findById(registrationId);
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

    // Reject registration and decrement competition count
    const updated = await Registration.reject(registrationId, req.user.id, reason);
    
    // Decrement competition registration count
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
// BULK APPROVE REGISTRATIONS
// =============================================================================

/**
 * @desc    Bulk approve multiple registrations
 * @route   POST /api/admin/registrations/bulk-approve
 * @access  Admin
 */
const bulkApprove = async (req, res) => {
  try {
    const { registrationIds } = req.body;

    if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'registrationIds must be a non-empty array'
      });
    }

    const result = await Registration.updateMany(
      {
        _id: { $in: registrationIds },
        status: 'pending'
      },
      {
        status: 'approved',
        processedBy: req.user.id,
        processedAt: new Date()
      }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} registrations approved`,
      data: {
        approved: result.modifiedCount,
        total: registrationIds.length
      }
    });

  } catch (error) {
    console.error('Bulk approve error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk approve registrations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// BULK REJECT REGISTRATIONS
// =============================================================================

/**
 * @desc    Bulk reject multiple registrations
 * @route   POST /api/admin/registrations/bulk-reject
 * @access  Admin
 */
const bulkReject = async (req, res) => {
  try {
    const { registrationIds, reason } = req.body;

    if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'registrationIds must be a non-empty array'
      });
    }

    // Get competitions to update counts
    const registrations = await Registration.find({
      _id: { $in: registrationIds },
      status: 'pending'
    }).select('competition');

    // Update registrations
    const result = await Registration.updateMany(
      {
        _id: { $in: registrationIds },
        status: 'pending'
      },
      {
        status: 'rejected',
        reason,
        processedBy: req.user.id,
        processedAt: new Date()
      }
    );

    // Decrement competition counts
    const competitionCounts = {};
    registrations.forEach(reg => {
      const compId = reg.competition.toString();
      competitionCounts[compId] = (competitionCounts[compId] || 0) + 1;
    });

    await Promise.all(
      Object.entries(competitionCounts).map(([compId, count]) =>
        Competition.updateRegistrationCount(compId, -count)
      )
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} registrations rejected`,
      data: {
        rejected: result.modifiedCount,
        total: registrationIds.length
      }
    });

  } catch (error) {
    console.error('Bulk reject error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk reject registrations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// UPDATE REGISTRATION (Admin notes, score, position)
// =============================================================================

/**
 * @desc    Update registration details
 * @route   PATCH /api/admin/registrations/:id
 * @access  Admin
 */
const updateRegistration = async (req, res) => {
  try {
    const registrationId = req.params.id;
    const { adminNotes, score, position, hasAttended } = req.body;

    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Update fields
    if (adminNotes !== undefined) registration.adminNotes = adminNotes;
    if (score !== undefined) registration.score = score;
    if (position !== undefined) registration.position = position;
    if (hasAttended !== undefined) registration.hasAttended = hasAttended;

    await registration.save();

    return res.status(200).json({
      success: true,
      message: 'Registration updated successfully',
      data: registration
    });

  } catch (error) {
    console.error('Update registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// EXPORT REGISTRATIONS
// =============================================================================

/**
 * @desc    Export registrations for a competition as CSV data
 * @route   GET /api/admin/competitions/:competitionId/registrations/export
 * @access  Admin
 */
const exportRegistrations = async (req, res) => {
  try {
    const { competitionId } = req.params;

    const registrations = await Registration.find({
      competition: competitionId
    })
      .populate('user', 'name email')
      .lean();

    // Format data for CSV
    const exportData = registrations.map(reg => ({
      confirmationCode: reg.confirmationCode,
      userName: reg.user?.name || 'N/A',
      userEmail: reg.user?.email || 'N/A',
      teamName: reg.teamName || 'N/A',
      institution: reg.institution || 'N/A',
      phone: reg.phone || 'N/A',
      status: reg.status,
      hasAttended: reg.hasAttended ? 'Yes' : 'No',
      score: reg.score || 'N/A',
      position: reg.position || 'N/A',
      registeredAt: reg.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('Export registrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export registrations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllRegistrations,
  getRegistrationById,
  approveRegistration,
  rejectRegistration,
  bulkApprove,
  bulkReject,
  updateRegistration,
  exportRegistrations
};
