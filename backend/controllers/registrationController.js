/**
 * =============================================================================
 * REGISTRATION CONTROLLER
 * =============================================================================
 * User endpoints for competition registration
 * 
 * Features:
 * - Register for competition with validation
 * - View my registrations
 * - Cancel registration
 * - Submit project (for hackathons)
 * =============================================================================
 */

const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Competition = require('../models/Competition');
const { getPagination, formatPagination } = require('../middleware/validators');

// =============================================================================
// REGISTER FOR COMPETITION
// =============================================================================

/**
 * @desc    Register for a competition
 * @route   POST /api/registrations/:competitionId
 * @access  Private
 */
const registerForCompetition = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const { competitionId } = req.params;
    const userId = req.user.id;
    const { teamName, teamMembers, phone, institution, additionalInfo } = req.body;

    // 1. Check if competition exists and is published
    const competition = await Competition.findOne({
      _id: competitionId,
      isDeleted: false
    }).session(session);

    if (!competition) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    // 2. Check if registration is open
    const { canRegister, reason } = competition.canRegister();
    if (!canRegister) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: reason
      });
    }

    // 3. Check if already registered
    const existingRegistration = await Registration.findOne({
      user: userId,
      competition: competitionId,
      status: { $ne: 'cancelled' }
    }).session(session);

    if (existingRegistration) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'You are already registered for this competition',
        data: {
          registrationId: existingRegistration._id,
          confirmationCode: existingRegistration.confirmationCode,
          status: existingRegistration.status
        }
      });
    }

    // 4. Validate team requirements for team competitions
    if (competition.type === 'team') {
      if (!teamName) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Team name is required for team competitions'
        });
      }

      const teamSize = (teamMembers?.length || 0) + 1; // +1 for the registering user
      if (teamSize < competition.teamSize.min) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Team must have at least ${competition.teamSize.min} members`
        });
      }
      if (teamSize > competition.teamSize.max) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Team cannot have more than ${competition.teamSize.max} members`
        });
      }
    }

    // 5. Create registration with transaction
    const registration = await Registration.createWithTransaction({
      user: userId,
      competition: competitionId,
      teamName,
      teamMembers,
      phone,
      institution,
      additionalInfo,
      status: 'pending'
    }, session);

    await session.commitTransaction();

    // Populate for response
    await registration.populate('competition', 'title slug deadline');

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Awaiting approval.',
      data: {
        _id: registration._id,
        confirmationCode: registration.confirmationCode,
        status: registration.status,
        competition: registration.competition,
        teamName: registration.teamName,
        createdAt: registration.createdAt
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Registration error:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You are already registered for this competition'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to register for competition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
};

// =============================================================================
// GET MY REGISTRATIONS
// =============================================================================

/**
 * @desc    Get current user's registrations
 * @route   GET /api/registrations/my
 * @access  Private
 */
const getMyRegistrations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page, limit } = req.query;

    const registrations = await Registration.getUserRegistrations(userId, {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    });

    // Get total count for pagination
    const filter = { user: userId };
    if (status) filter.status = status;
    const total = await Registration.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        registrations,
        pagination: formatPagination(total, parseInt(page) || 1, parseInt(limit) || 10)
      }
    });

  } catch (error) {
    console.error('Get my registrations error:', error);
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
 * @route   GET /api/registrations/:id
 * @access  Private (owner only)
 */
const getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const registration = await Registration.findOne({
      _id: id,
      user: userId
    })
      .populate({
        path: 'competition',
        select: 'title slug description deadline category type venue isOnline startDate endDate',
        populate: {
          path: 'category',
          select: 'name slug color'
        }
      })
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
// CANCEL REGISTRATION
// =============================================================================

/**
 * @desc    Cancel a registration
 * @route   PATCH /api/registrations/:id/cancel
 * @access  Private (owner only)
 */
const cancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const registration = await Registration.findOne({
      _id: id,
      user: userId
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Registration is already cancelled'
      });
    }

    if (registration.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed registration'
      });
    }

    // Cancel the registration
    await registration.cancel(reason || 'Cancelled by user');

    return res.status(200).json({
      success: true,
      message: 'Registration cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// SUBMIT PROJECT
// =============================================================================

/**
 * @desc    Submit project for hackathon
 * @route   POST /api/registrations/:id/submit
 * @access  Private (owner only)
 */
const submitProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { link, description } = req.body;

    const registration = await Registration.findOne({
      _id: id,
      user: userId
    }).populate('competition', 'deadline endDate');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved registrations can submit projects'
      });
    }

    // Check if submission deadline has passed
    const submissionDeadline = registration.competition.endDate || registration.competition.deadline;
    if (submissionDeadline < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Submission deadline has passed'
      });
    }

    // Submit project
    await registration.submitProject({ link, description });

    return res.status(200).json({
      success: true,
      message: 'Project submitted successfully',
      data: {
        submission: registration.submission
      }
    });

  } catch (error) {
    console.error('Submit project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// CHECK REGISTRATION STATUS
// =============================================================================

/**
 * @desc    Check if user is registered for a competition
 * @route   GET /api/registrations/check/:competitionId
 * @access  Private
 */
const checkRegistrationStatus = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const userId = req.user.id;

    const registration = await Registration.findOne({
      user: userId,
      competition: competitionId,
      status: { $ne: 'cancelled' }
    }).select('status confirmationCode createdAt');

    if (!registration) {
      return res.status(200).json({
        success: true,
        data: {
          isRegistered: false
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        isRegistered: true,
        registration: {
          _id: registration._id,
          status: registration.status,
          confirmationCode: registration.confirmationCode,
          registeredAt: registration.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Check registration status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check registration status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET REGISTRATION BY CONFIRMATION CODE
// =============================================================================

/**
 * @desc    Get registration by confirmation code
 * @route   GET /api/registrations/code/:code
 * @access  Private (owner only)
 */
const getByConfirmationCode = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;

    const registration = await Registration.findOne({
      confirmationCode: code,
      user: userId
    })
      .populate({
        path: 'competition',
        select: 'title slug deadline category',
        populate: {
          path: 'category',
          select: 'name slug'
        }
      })
      .select('-adminNotes')
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
    console.error('Get by confirmation code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  registerForCompetition,
  getMyRegistrations,
  getRegistrationById,
  cancelRegistration,
  submitProject,
  checkRegistrationStatus,
  getByConfirmationCode
};
