/**
 * =============================================================================
 * COMPETITION MODEL
 * =============================================================================
 * Model for competitions/hackathons
 * 
 * Features:
 * - Full-text search on title and description
 * - Category relationship
 * - Registration tracking with denormalized count
 * - Deadline management
 * - Prize information
 * - Status management (draft, published, cancelled, completed)
 * - Trending calculation support
 * =============================================================================
 */

const mongoose = require('mongoose');

// =============================================================================
// SUB-SCHEMAS
// =============================================================================

/**
 * Prize structure for competitions
 */
const PrizeSchema = new mongoose.Schema({
  position: {
    type: Number,
    required: true,
    min: 1
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    min: 0
  },
  currency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD', 'EUR', 'GBP']
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: false });

/**
 * Timeline/schedule for competitions
 */
const TimelineSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: false });

/**
 * FAQ for competitions
 */
const FAQSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

// =============================================================================
// MAIN SCHEMA
// =============================================================================

const CompetitionSchema = new mongoose.Schema({
  /**
   * Competition title
   */
  title: {
    type: String,
    required: [true, 'Competition title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  /**
   * URL-friendly slug
   */
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },

  /**
   * Short description for cards/previews
   */
  shortDescription: {
    type: String,
    trim: true,
    maxlength: [300, 'Short description cannot exceed 300 characters']
  },

  /**
   * Full description (supports markdown)
   */
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [20, 'Description must be at least 20 characters']
  },

  /**
   * Category reference
   */
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
    index: true
  },

  /**
   * Competition banner/cover image (legacy - use images.cover instead)
   */
  banner: {
    type: String,
    trim: true
  },

  /**
   * Competition thumbnail (legacy - use images.cover.thumbnail instead)
   */
  thumbnail: {
    type: String,
    trim: true
  },

  /**
   * Optimized images for competition
   */
  images: {
    cover: {
      url: { type: String },
      medium: { type: String },
      thumbnail: { type: String },
      placeholder: { type: String }
    },
    gallery: [{
      url: { type: String },
      medium: { type: String },
      thumbnail: { type: String },
      placeholder: { type: String }
    }]
  },

  /**
   * Registration deadline
   */
  deadline: {
    type: Date,
    required: [true, 'Registration deadline is required'],
    index: true,
    validate: {
      validator: function(value) {
        // For new documents, deadline must be in the future
        if (this.isNew) {
          return value > new Date();
        }
        return true;
      },
      message: 'Deadline must be in the future'
    }
  },

  /**
   * Competition start date
   */
  startDate: {
    type: Date,
    index: true
  },

  /**
   * Competition end date
   */
  endDate: {
    type: Date
  },

  /**
   * Maximum number of registrations (0 = unlimited)
   */
  maxRegistrations: {
    type: Number,
    default: 0,
    min: 0
  },

  /**
   * Current registration count (denormalized for performance)
   */
  registrationsCount: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },

  /**
   * Prize details
   */
  prizes: [PrizeSchema],

  /**
   * Total prize pool
   */
  totalPrizePool: {
    type: Number,
    default: 0,
    min: 0
  },

  /**
   * Prize currency
   */
  prizeCurrency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD', 'EUR', 'GBP']
  },

  /**
   * Competition venue/location
   */
  venue: {
    type: String,
    trim: true
  },

  /**
   * Is this an online competition?
   */
  isOnline: {
    type: Boolean,
    default: false
  },

  /**
   * Competition type
   */
  type: {
    type: String,
    enum: ['individual', 'team'],
    default: 'individual'
  },

  /**
   * Team size constraints (for team competitions)
   */
  teamSize: {
    min: { type: Number, default: 1, min: 1 },
    max: { type: Number, default: 1, min: 1 }
  },

  /**
   * Competition timeline/schedule
   */
  timeline: [TimelineSchema],

  /**
   * Requirements/eligibility
   */
  requirements: [{
    type: String,
    trim: true
  }],

  /**
   * Rules and guidelines
   */
  rules: [{
    type: String,
    trim: true
  }],

  /**
   * FAQs
   */
  faqs: [FAQSchema],

  /**
   * Competition status
   */
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft',
    index: true
  },

  /**
   * Featured competition (shown on homepage)
   */
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },

  /**
   * View count for analytics
   */
  viewsCount: {
    type: Number,
    default: 0,
    min: 0
  },

  /**
   * Tags for filtering
   */
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  /**
   * External registration link (if registration is external)
   */
  externalLink: {
    type: String,
    trim: true
  },

  /**
   * Contact email for inquiries
   */
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true
  },

  /**
   * Organizer information
   */
  organizer: {
    name: { type: String, trim: true },
    logo: { type: String, trim: true },
    website: { type: String, trim: true }
  },

  /**
   * Sponsors
   */
  sponsors: [{
    name: { type: String, trim: true },
    logo: { type: String, trim: true },
    website: { type: String, trim: true },
    tier: { 
      type: String, 
      enum: ['platinum', 'gold', 'silver', 'bronze', 'partner'],
      default: 'partner'
    }
  }],

  /**
   * Admin who created
   */
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  /**
   * Admin who last updated
   */
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  /**
   * Soft delete flag
   */
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// =============================================================================
// INDEXES
// =============================================================================

// Text index for full-text search
CompetitionSchema.index({ 
  title: 'text', 
  description: 'text',
  shortDescription: 'text',
  tags: 'text'
}, {
  weights: {
    title: 10,
    tags: 5,
    shortDescription: 3,
    description: 1
  },
  name: 'competition_text_index'
});

// Compound indexes for common queries
CompetitionSchema.index({ status: 1, deadline: 1, category: 1 });
CompetitionSchema.index({ status: 1, createdAt: -1 });
CompetitionSchema.index({ status: 1, registrationsCount: -1 });
CompetitionSchema.index({ isFeatured: 1, status: 1, deadline: 1 });
CompetitionSchema.index({ category: 1, status: 1, deadline: 1 });

// =============================================================================
// VIRTUALS
// =============================================================================

/**
 * Check if registration is still open
 */
CompetitionSchema.virtual('isRegistrationOpen').get(function() {
  if (this.status !== 'published') return false;
  if (this.deadline < new Date()) return false;
  if (this.maxRegistrations > 0 && this.registrationsCount >= this.maxRegistrations) return false;
  return true;
});

/**
 * Check if competition is upcoming
 */
CompetitionSchema.virtual('isUpcoming').get(function() {
  return this.startDate && this.startDate > new Date();
});

/**
 * Check if competition is ongoing
 */
CompetitionSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  return this.startDate && this.endDate && 
         this.startDate <= now && this.endDate >= now;
});

/**
 * Days until deadline
 */
CompetitionSchema.virtual('daysUntilDeadline').get(function() {
  const diff = this.deadline - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

/**
 * Registration progress percentage
 */
CompetitionSchema.virtual('registrationProgress').get(function() {
  if (!this.maxRegistrations || this.maxRegistrations === 0) return null;
  return Math.round((this.registrationsCount / this.maxRegistrations) * 100);
});

// =============================================================================
// PRE-SAVE MIDDLEWARE
// =============================================================================

/**
 * Generate slug and calculate total prize pool
 */
CompetitionSchema.pre('save', function(next) {
  // Generate slug
  if (this.isModified('title')) {
    const baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  // Calculate total prize pool
  if (this.isModified('prizes')) {
    this.totalPrizePool = this.prizes.reduce((sum, prize) => {
      return sum + (prize.amount || 0);
    }, 0);
  }

  next();
});

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Build filter query from request params
 * @param {Object} params - Query parameters
 * @returns {Object} MongoDB filter object
 */
CompetitionSchema.statics.buildQuery = function(params) {
  const filter = { 
    isDeleted: false,
    status: 'published'
  };

  // Category filter
  if (params.category) {
    filter.category = params.category;
  }

  // Date range filter
  if (params.startDate && params.endDate) {
    filter.deadline = {
      $gte: new Date(params.startDate),
      $lte: new Date(params.endDate)
    };
  } else if (params.startDate) {
    filter.deadline = { $gte: new Date(params.startDate) };
  } else if (params.endDate) {
    filter.deadline = { $lte: new Date(params.endDate) };
  }

  // Active competitions only (deadline not passed)
  if (params.active === 'true') {
    filter.deadline = { ...filter.deadline, $gte: new Date() };
  }

  // Featured only
  if (params.featured === 'true') {
    filter.isFeatured = true;
  }

  // Type filter
  if (params.type) {
    filter.type = params.type;
  }

  // Online/offline filter
  if (params.isOnline !== undefined) {
    filter.isOnline = params.isOnline === 'true';
  }

  // Tags filter
  if (params.tags) {
    const tagsArray = params.tags.split(',').map(t => t.trim().toLowerCase());
    filter.tags = { $in: tagsArray };
  }

  // Text search
  if (params.search) {
    filter.$text = { $search: params.search };
  }

  return filter;
};

/**
 * Build sort object from query params
 * @param {string} sortBy - Sort type
 * @returns {Object} MongoDB sort object
 */
CompetitionSchema.statics.buildSort = function(sortBy) {
  switch (sortBy) {
    case 'most':
      // Most registrations
      return { registrationsCount: -1, createdAt: -1 };
    case 'trending':
      // Will be handled in query with date filter
      return { registrationsCount: -1, createdAt: -1 };
    case 'new':
      return { createdAt: -1 };
    case 'deadline':
      return { deadline: 1 };
    case 'prize':
      return { totalPrizePool: -1 };
    case 'views':
      return { viewsCount: -1 };
    default:
      return { createdAt: -1 };
  }
};

/**
 * Find trending competitions (created in last 7 days, sorted by registrations)
 * @param {number} limit - Number of results
 * @returns {Promise<Array>}
 */
CompetitionSchema.statics.findTrending = function(limit = 10) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return this.find({
    isDeleted: false,
    status: 'published',
    createdAt: { $gte: sevenDaysAgo },
    deadline: { $gte: new Date() }
  })
    .sort({ registrationsCount: -1 })
    .limit(limit)
    .select('title slug shortDescription thumbnail deadline registrationsCount category')
    .populate('category', 'name slug color')
    .lean();
};

/**
 * Find featured competitions
 * @param {number} limit - Number of results
 * @returns {Promise<Array>}
 */
CompetitionSchema.statics.findFeatured = function(limit = 5) {
  return this.find({
    isDeleted: false,
    status: 'published',
    isFeatured: true,
    deadline: { $gte: new Date() }
  })
    .sort({ deadline: 1 })
    .limit(limit)
    .select('title slug shortDescription banner thumbnail deadline registrationsCount category totalPrizePool')
    .populate('category', 'name slug color')
    .lean();
};

/**
 * Get competitions for calendar view
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Array>}
 */
CompetitionSchema.statics.getCalendarView = function(month, year) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  return this.find({
    isDeleted: false,
    status: 'published',
    deadline: {
      $gte: startOfMonth,
      $lte: endOfMonth
    }
  })
    .select('title slug deadline category thumbnail')
    .populate('category', 'name slug color')
    .sort({ deadline: 1 })
    .lean();
};

/**
 * Increment registration count
 * @param {ObjectId} competitionId - Competition ID
 * @param {number} amount - Amount to increment
 */
CompetitionSchema.statics.updateRegistrationCount = function(competitionId, amount = 1) {
  return this.findByIdAndUpdate(
    competitionId,
    { $inc: { registrationsCount: amount } },
    { new: true }
  );
};

/**
 * Increment view count
 * @param {ObjectId} competitionId - Competition ID
 */
CompetitionSchema.statics.incrementViews = function(competitionId) {
  return this.findByIdAndUpdate(
    competitionId,
    { $inc: { viewsCount: 1 } },
    { new: true }
  );
};

/**
 * Get statistics for admin dashboard
 * @returns {Promise<Object>}
 */
CompetitionSchema.statics.getStats = async function() {
  const now = new Date();
  
  const [stats] = await this.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        published: {
          $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
        },
        draft: {
          $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
        },
        active: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'published'] },
                  { $gte: ['$deadline', now] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalRegistrations: { $sum: '$registrationsCount' },
        totalViews: { $sum: '$viewsCount' },
        avgRegistrations: { $avg: '$registrationsCount' }
      }
    }
  ]);

  return stats || {
    total: 0,
    published: 0,
    draft: 0,
    active: 0,
    totalRegistrations: 0,
    totalViews: 0,
    avgRegistrations: 0
  };
};

// =============================================================================
// INSTANCE METHODS
// =============================================================================

/**
 * Soft delete competition
 */
CompetitionSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.status = 'cancelled';
  this.updatedBy = userId;
  return this.save();
};

/**
 * Publish competition
 */
CompetitionSchema.methods.publish = function(userId) {
  this.status = 'published';
  this.updatedBy = userId;
  return this.save();
};

/**
 * Check if user can register
 * @param {ObjectId} userId - User ID
 * @returns {Object} { canRegister: boolean, reason: string }
 */
CompetitionSchema.methods.canRegister = function() {
  if (this.status !== 'published') {
    return { canRegister: false, reason: 'Competition is not published' };
  }
  if (this.deadline < new Date()) {
    return { canRegister: false, reason: 'Registration deadline has passed' };
  }
  if (this.maxRegistrations > 0 && this.registrationsCount >= this.maxRegistrations) {
    return { canRegister: false, reason: 'Maximum registrations reached' };
  }
  return { canRegister: true, reason: null };
};

const Competition = mongoose.model('Competition', CompetitionSchema);

module.exports = Competition;
