/**
 * =============================================================================
 * PUBLIC CATEGORY CONTROLLER
 * =============================================================================
 * Public endpoints for browsing categories
 * =============================================================================
 */

const Category = require('../models/Category');
const cacheService = require('../config/cache');

// Cache configuration
const CACHE_KEY = 'categories:public:all';
const CACHE_TTL = 3600; // 1 hour

// =============================================================================
// GET ALL ACTIVE CATEGORIES
// =============================================================================

/**
 * @desc    Get all active categories
 * @route   GET /api/categories
 * @access  Public
 */
const getCategories = async (req, res) => {
  try {
    // Try cache first
    const cached = await cacheService.get(CACHE_KEY);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Fetch from database
    const categories = await Category.getWithStats();

    // Cache results
    await cacheService.set(CACHE_KEY, categories, CACHE_TTL);

    return res.status(200).json({
      success: true,
      data: categories,
      cached: false
    });

  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET CATEGORY BY SLUG
// =============================================================================

/**
 * @desc    Get category by slug with competitions
 * @route   GET /api/categories/:slug
 * @access  Public
 */
const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({ 
      slug, 
      isActive: true 
    })
      .select('name slug description icon color competitionsCount')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: category
    });

  } catch (error) {
    console.error('Get category by slug error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getCategories,
  getCategoryBySlug
};
