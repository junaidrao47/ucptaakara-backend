/**
 * =============================================================================
 * CATEGORY MODEL
 * =============================================================================
 * Model for competition categories (e.g., Hackathon, Coding Challenge, etc.)
 * 
 * Features:
 * - Unique category names
 * - Slug generation for URLs
 * - Competition count tracking
 * - Soft delete support
 * - Caching integration
 * =============================================================================
 */

const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  /**
   * Category name - must be unique
   * @example "Hackathon", "Coding Challenge", "Design Contest"
   */
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Category name must be at least 2 characters'],
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },

  /**
   * URL-friendly slug generated from name
   * @example "hackathon", "coding-challenge"
   */
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },

  /**
   * Category description
   */
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  /**
   * Category icon/image URL (legacy - use images.icon instead)
   */
  icon: {
    type: String,
    trim: true
  },

  /**
   * Category images (optimized versions)
   */
  images: {
    icon: {
      url: { type: String },
      thumbnail: { type: String },
      placeholder: { type: String }
    },
    banner: {
      url: { type: String },
      thumbnail: { type: String },
      placeholder: { type: String }
    }
  },

  /**
   * Category color for UI
   * @example "#FF5733", "blue"
   */
  color: {
    type: String,
    default: '#3B82F6'
  },

  /**
   * Number of competitions in this category
   * Denormalized for performance
   */
  competitionsCount: {
    type: Number,
    default: 0,
    min: 0
  },

  /**
   * Display order for sorting
   */
  displayOrder: {
    type: Number,
    default: 0
  },

  /**
   * Whether category is active and visible
   */
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  /**
   * Admin who created the category
   */
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  /**
   * Admin who last updated the category
   */
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// =============================================================================
// INDEXES
// =============================================================================

// Compound index for active categories sorted by display order
CategorySchema.index({ isActive: 1, displayOrder: 1 });

// Text index for search
CategorySchema.index({ name: 'text', description: 'text' });

// =============================================================================
// VIRTUALS
// =============================================================================

/**
 * Virtual populate for competitions in this category
 */
CategorySchema.virtual('competitions', {
  ref: 'Competition',
  localField: '_id',
  foreignField: 'category',
  justOne: false
});

// =============================================================================
// PRE-SAVE MIDDLEWARE
// =============================================================================

/**
 * Generate slug from name before saving
 */
CategorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Find all active categories sorted by display order
 * @param {boolean} includeCount - Include competition count
 * @returns {Promise<Array>} Array of categories
 */
CategorySchema.statics.findActive = function(includeCount = false) {
  let query = this.find({ isActive: true })
    .sort({ displayOrder: 1, name: 1 });
  
  if (includeCount) {
    query = query.select('name slug description icon color competitionsCount');
  } else {
    query = query.select('name slug description icon color');
  }
  
  return query.lean();
};

/**
 * Find category by slug
 * @param {string} slug - Category slug
 * @returns {Promise<Object>} Category document
 */
CategorySchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug, isActive: true }).lean();
};

/**
 * Increment competition count
 * @param {ObjectId} categoryId - Category ID
 * @param {number} amount - Amount to increment (can be negative)
 */
CategorySchema.statics.updateCompetitionCount = function(categoryId, amount = 1) {
  return this.findByIdAndUpdate(
    categoryId,
    { $inc: { competitionsCount: amount } },
    { new: true }
  );
};

/**
 * Get categories with competition stats
 * @returns {Promise<Array>} Categories with stats
 */
CategorySchema.statics.getWithStats = async function() {
  return this.aggregate([
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
        description: 1,
        icon: 1,
        color: 1,
        displayOrder: 1,
        competitionsCount: { $size: '$competitions' },
        activeCompetitions: {
          $size: {
            $filter: {
              input: '$competitions',
              as: 'comp',
              cond: { $gte: ['$$comp.deadline', new Date()] }
            }
          }
        }
      }
    },
    { $sort: { displayOrder: 1, name: 1 } }
  ]);
};

// =============================================================================
// INSTANCE METHODS
// =============================================================================

/**
 * Soft delete category
 */
CategorySchema.methods.softDelete = function() {
  this.isActive = false;
  return this.save();
};

/**
 * Restore soft-deleted category
 */
CategorySchema.methods.restore = function() {
  this.isActive = true;
  return this.save();
};

const Category = mongoose.model('Category', CategorySchema);

module.exports = Category;
