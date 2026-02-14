/**
 * =============================================================================
 * REGISTRATION MODEL
 * =============================================================================
 * Model for competition registrations
 * 
 * Features:
 * - User to Competition relationship
 * - Status tracking (pending, approved, rejected, cancelled)
 * - Team support
 * - Transaction-safe operations
 * - Duplicate prevention
 * =============================================================================
 */

const mongoose = require('mongoose');

// =============================================================================
// SUB-SCHEMAS
// =============================================================================

/**
 * Team member structure
 */
const TeamMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    trim: true,
    default: 'Member'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

// =============================================================================
// MAIN SCHEMA
// =============================================================================

const RegistrationSchema = new mongoose.Schema({
  /**
   * User who registered
   */
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },

  /**
   * Competition registered for
   */
  competition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competition',
    required: [true, 'Competition is required'],
    index: true
  },

  /**
   * Registration status
   */
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'pending',
    index: true
  },

  /**
   * Team name (for team competitions)
   */
  teamName: {
    type: String,
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters']
  },

  /**
   * Team members (for team competitions)
   */
  teamMembers: [TeamMemberSchema],

  /**
   * Additional registration data
   */
  additionalInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  /**
   * Participant phone number
   */
  phone: {
    type: String,
    trim: true
  },

  /**
   * Institution/Organization
   */
  institution: {
    type: String,
    trim: true,
    maxlength: [200, 'Institution name cannot exceed 200 characters']
  },

  /**
   * Admin notes (internal)
   */
  adminNotes: {
    type: String,
    trim: true
  },

  /**
   * Rejection/cancellation reason
   */
  reason: {
    type: String,
    trim: true
  },

  /**
   * Registration confirmation code
   */
  confirmationCode: {
    type: String,
    unique: true,
    sparse: true
  },

  /**
   * Attendance tracking
   */
  hasAttended: {
    type: Boolean,
    default: false
  },

  /**
   * Submission (for hackathons)
   */
  submission: {
    link: { type: String, trim: true },
    description: { type: String, trim: true },
    submittedAt: { type: Date }
  },

  /**
   * Score/Rating (for judging)
   */
  score: {
    type: Number,
    min: 0,
    max: 100
  },

  /**
   * Final position/rank
   */
  position: {
    type: Number,
    min: 1
  },

  /**
   * Approved/Processed by (admin)
   */
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  /**
   * Date when processed
   */
  processedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// =============================================================================
// INDEXES
// =============================================================================

// Compound unique index to prevent duplicate registrations
RegistrationSchema.index({ user: 1, competition: 1 }, { unique: true });

// Index for user's registrations
RegistrationSchema.index({ user: 1, status: 1, createdAt: -1 });

// Index for competition's registrations
RegistrationSchema.index({ competition: 1, status: 1, createdAt: -1 });

// Index for admin queries
RegistrationSchema.index({ status: 1, createdAt: -1 });

// =============================================================================
// PRE-SAVE MIDDLEWARE
// =============================================================================

/**
 * Generate confirmation code on creation
 */
RegistrationSchema.pre('save', function(next) {
  if (this.isNew && !this.confirmationCode) {
    // Generate unique confirmation code: PREFIX-RANDOM
    const prefix = 'REG';
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    this.confirmationCode = `${prefix}-${timestamp}-${random}`;
  }
  next();
});

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Check if user is already registered for a competition
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} competitionId - Competition ID
 * @returns {Promise<boolean>}
 */
RegistrationSchema.statics.isAlreadyRegistered = async function(userId, competitionId) {
  const existing = await this.findOne({
    user: userId,
    competition: competitionId,
    status: { $ne: 'cancelled' }
  });
  return !!existing;
};

/**
 * Create registration with transaction (increments competition count)
 * @param {Object} registrationData - Registration data
 * @param {Object} session - MongoDB session for transaction
 * @returns {Promise<Object>} Created registration
 */
RegistrationSchema.statics.createWithTransaction = async function(registrationData, session) {
  const Competition = mongoose.model('Competition');
  
  // Create registration
  const [registration] = await this.create([registrationData], { session });
  
  // Increment competition registration count
  await Competition.findByIdAndUpdate(
    registrationData.competition,
    { $inc: { registrationsCount: 1 } },
    { session }
  );
  
  return registration;
};

/**
 * Get user's registrations with competition details
 * @param {ObjectId} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
RegistrationSchema.statics.getUserRegistrations = function(userId, options = {}) {
  const { status, page = 1, limit = 10 } = options;
  
  const filter = { user: userId };
  if (status) {
    filter.status = status;
  }

  return this.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('competition status teamName confirmationCode createdAt')
    .populate({
      path: 'competition',
      select: 'title slug thumbnail deadline category status',
      populate: {
        path: 'category',
        select: 'name slug color'
      }
    })
    .lean();
};

/**
 * Get registrations for a competition (admin)
 * @param {ObjectId} competitionId - Competition ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Paginated results
 */
RegistrationSchema.statics.getCompetitionRegistrations = async function(competitionId, options = {}) {
  const { status, page = 1, limit = 20, search } = options;
  
  const filter = { competition: competitionId };
  if (status) {
    filter.status = status;
  }

  // Build aggregation pipeline for search
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
    { $unwind: '$userDetails' }
  ];

  // Add search filter
  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { 'userDetails.name': { $regex: search, $options: 'i' } },
          { 'userDetails.email': { $regex: search, $options: 'i' } },
          { teamName: { $regex: search, $options: 'i' } },
          { confirmationCode: { $regex: search, $options: 'i' } }
        ]
      }
    });
  }

  // Get total count
  const countPipeline = [...pipeline, { $count: 'total' }];
  const [countResult] = await this.aggregate(countPipeline);
  const total = countResult?.total || 0;

  // Add pagination and projection
  pipeline.push(
    { $sort: { createdAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        status: 1,
        teamName: 1,
        teamMembers: 1,
        institution: 1,
        phone: 1,
        confirmationCode: 1,
        hasAttended: 1,
        score: 1,
        position: 1,
        createdAt: 1,
        'user._id': '$userDetails._id',
        'user.name': '$userDetails.name',
        'user.email': '$userDetails.email',
        'user.avatar': '$userDetails.avatar'
      }
    }
  );

  const registrations = await this.aggregate(pipeline);

  return {
    registrations,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get registration statistics for a competition
 * @param {ObjectId} competitionId - Competition ID
 * @returns {Promise<Object>}
 */
RegistrationSchema.statics.getCompetitionStats = async function(competitionId) {
  const stats = await this.aggregate([
    { $match: { competition: new mongoose.Types.ObjectId(competitionId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0
  };

  stats.forEach(s => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  return result;
};

/**
 * Get overall registration statistics (admin analytics)
 * @returns {Promise<Object>}
 */
RegistrationSchema.statics.getOverallStats = async function() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [stats] = await this.aggregate([
    {
      $facet: {
        overall: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
              rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
            }
          }
        ],
        last30Days: [
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          { $count: 'count' }
        ],
        last7Days: [
          { $match: { createdAt: { $gte: sevenDaysAgo } } },
          { $count: 'count' }
        ],
        daily: [
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]
      }
    }
  ]);

  return {
    overall: stats.overall[0] || { total: 0, pending: 0, approved: 0, rejected: 0 },
    last30Days: stats.last30Days[0]?.count || 0,
    last7Days: stats.last7Days[0]?.count || 0,
    dailyTrend: stats.daily
  };
};

/**
 * Approve registration
 * @param {ObjectId} registrationId - Registration ID
 * @param {ObjectId} adminId - Admin user ID
 * @returns {Promise<Object>}
 */
RegistrationSchema.statics.approve = function(registrationId, adminId) {
  return this.findByIdAndUpdate(
    registrationId,
    {
      status: 'approved',
      processedBy: adminId,
      processedAt: new Date()
    },
    { new: true }
  );
};

/**
 * Reject registration
 * @param {ObjectId} registrationId - Registration ID
 * @param {ObjectId} adminId - Admin user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>}
 */
RegistrationSchema.statics.reject = function(registrationId, adminId, reason) {
  return this.findByIdAndUpdate(
    registrationId,
    {
      status: 'rejected',
      reason,
      processedBy: adminId,
      processedAt: new Date()
    },
    { new: true }
  );
};

// =============================================================================
// INSTANCE METHODS
// =============================================================================

/**
 * Cancel registration
 * @param {string} reason - Cancellation reason
 */
RegistrationSchema.methods.cancel = async function(reason) {
  const Competition = mongoose.model('Competition');
  
  // Only decrement count if was approved or pending
  if (['pending', 'approved'].includes(this.status)) {
    await Competition.findByIdAndUpdate(
      this.competition,
      { $inc: { registrationsCount: -1 } }
    );
  }
  
  this.status = 'cancelled';
  this.reason = reason;
  return this.save();
};

/**
 * Submit project (for hackathons)
 * @param {Object} submissionData - Submission data
 */
RegistrationSchema.methods.submitProject = function(submissionData) {
  this.submission = {
    link: submissionData.link,
    description: submissionData.description,
    submittedAt: new Date()
  };
  return this.save();
};

const Registration = mongoose.model('Registration', RegistrationSchema);

module.exports = Registration;
