/**
 * =============================================================================
 * ADMIN CATEGORY CONTROLLER
 * =============================================================================
 * Handles CRUD operations for competition categories
 * All endpoints require admin authentication
 * =============================================================================
 */

const Category = require('../../models/Category');
const Competition = require('../../models/Competition');
const cacheService = require('../../config/cache');
const { getPagination, formatPagination } = require('../../middleware/validators');
const { uploadToS3, deleteFromS3, generateS3Key, extractKeyFromUrl } = require('../../config/s3');
const { processCategoryImage } = require('../../utils/imageOptimizer');

// Cache keys
const CACHE_KEYS = {
  ALL_CATEGORIES: 'categories:all',
  CATEGORY_PREFIX: 'category:'
};

// =============================================================================
// CREATE CATEGORY
// =============================================================================

/**
 * @desc    Create a new category
 * @route   POST /api/admin/categories
 * @access  Admin
 */
const createCategory = async (req, res) => {
  try {
    const { name, description, icon, color, displayOrder } = req.body;

    // Check if category name already exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    
    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    // Create category first to get ID
    const category = await Category.create({
      name,
      description,
      icon,
      color,
      displayOrder,
      createdBy: req.user.id
    });

    // Process and upload images if provided
    const images = {};
    const files = req.files;

    if (files && (files.icon || files.banner)) {
      // Process icon
      if (files.icon && files.icon[0]) {
        const iconFile = files.icon[0];
        const processed = await processCategoryImage(iconFile.buffer, 'icon');
        
        const iconKey = generateS3Key('categories', category._id.toString(), 'icon.webp');
        const iconResult = await uploadToS3(processed.original, iconKey, 'image/webp');
        
        const iconThumbKey = generateS3Key('categories', category._id.toString(), 'icon-thumb.webp');
        const iconThumbResult = await uploadToS3(processed.thumbnail, iconThumbKey, 'image/webp');

        images.icon = {
          url: iconResult.url,
          thumbnail: iconThumbResult.url,
          placeholder: processed.placeholder
        };
      }

      // Process banner
      if (files.banner && files.banner[0]) {
        const bannerFile = files.banner[0];
        const processed = await processCategoryImage(bannerFile.buffer, 'banner');
        
        const bannerKey = generateS3Key('categories', category._id.toString(), 'banner.webp');
        const bannerResult = await uploadToS3(processed.original, bannerKey, 'image/webp');
        
        const bannerThumbKey = generateS3Key('categories', category._id.toString(), 'banner-thumb.webp');
        const bannerThumbResult = await uploadToS3(processed.thumbnail, bannerThumbKey, 'image/webp');

        images.banner = {
          url: bannerResult.url,
          thumbnail: bannerThumbResult.url,
          placeholder: processed.placeholder
        };
      }

      // Update category with images
      if (Object.keys(images).length > 0) {
        category.images = images;
        await category.save();
      }
    }

    // Invalidate cache
    await cacheService.delete(CACHE_KEYS.ALL_CATEGORIES);

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });

  } catch (error) {
    console.error('Create category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET ALL CATEGORIES (Admin view with full details)
// =============================================================================

/**
 * @desc    Get all categories with stats
 * @route   GET /api/admin/categories
 * @access  Admin
 */
const getAllCategories = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20 });
    const { search, isActive } = req.query;

    // Build filter
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Execute query
    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort({ displayOrder: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .lean(),
      Category.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        categories,
        pagination: formatPagination(total, page, limit)
      }
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
// GET SINGLE CATEGORY
// =============================================================================

/**
 * @desc    Get category by ID
 * @route   GET /api/admin/categories/:id
 * @access  Admin
 */
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get competition count for this category
    const competitionCount = await Competition.countDocuments({
      category: category._id,
      isDeleted: false
    });

    return res.status(200).json({
      success: true,
      data: {
        ...category,
        competitionsCount: competitionCount
      }
    });

  } catch (error) {
    console.error('Get category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// UPDATE CATEGORY
// =============================================================================

/**
 * @desc    Update category
 * @route   PUT /api/admin/categories/:id
 * @access  Admin
 */
const updateCategory = async (req, res) => {
  try {
    const { name, description, icon, color, displayOrder, isActive } = req.body;
    const categoryId = req.params.id;

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check for duplicate name (excluding current category)
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: categoryId }
      });
      
      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }

    // Update fields
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;
    category.updatedBy = req.user.id;

    // Process and upload images if provided
    const files = req.files;
    const oldImages = [];

    if (files && (files.icon || files.banner)) {
      if (!category.images) category.images = {};

      // Process icon
      if (files.icon && files.icon[0]) {
        const iconFile = files.icon[0];
        const processed = await processCategoryImage(iconFile.buffer, 'icon');
        
        const iconKey = generateS3Key('categories', categoryId, 'icon.webp');
        const iconResult = await uploadToS3(processed.original, iconKey, 'image/webp');
        
        const iconThumbKey = generateS3Key('categories', categoryId, 'icon-thumb.webp');
        const iconThumbResult = await uploadToS3(processed.thumbnail, iconThumbKey, 'image/webp');

        // Track old images for deletion
        if (category.images.icon?.url) oldImages.push(extractKeyFromUrl(category.images.icon.url));
        if (category.images.icon?.thumbnail) oldImages.push(extractKeyFromUrl(category.images.icon.thumbnail));

        category.images.icon = {
          url: iconResult.url,
          thumbnail: iconThumbResult.url,
          placeholder: processed.placeholder
        };
      }

      // Process banner
      if (files.banner && files.banner[0]) {
        const bannerFile = files.banner[0];
        const processed = await processCategoryImage(bannerFile.buffer, 'banner');
        
        const bannerKey = generateS3Key('categories', categoryId, 'banner.webp');
        const bannerResult = await uploadToS3(processed.original, bannerKey, 'image/webp');
        
        const bannerThumbKey = generateS3Key('categories', categoryId, 'banner-thumb.webp');
        const bannerThumbResult = await uploadToS3(processed.thumbnail, bannerThumbKey, 'image/webp');

        // Track old images for deletion
        if (category.images.banner?.url) oldImages.push(extractKeyFromUrl(category.images.banner.url));
        if (category.images.banner?.thumbnail) oldImages.push(extractKeyFromUrl(category.images.banner.thumbnail));

        category.images.banner = {
          url: bannerResult.url,
          thumbnail: bannerThumbResult.url,
          placeholder: processed.placeholder
        };
      }

      // Delete old images from S3 (async)
      oldImages.filter(Boolean).forEach(key => deleteFromS3(key));
    }

    await category.save();

    // Invalidate cache
    await cacheService.delete(CACHE_KEYS.ALL_CATEGORIES);
    await cacheService.delete(`${CACHE_KEYS.CATEGORY_PREFIX}${categoryId}`);

    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });

  } catch (error) {
    console.error('Update category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// DELETE CATEGORY
// =============================================================================

/**
 * @desc    Delete category (soft delete)
 * @route   DELETE /api/admin/categories/:id
 * @access  Admin
 */
const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has competitions
    const competitionCount = await Competition.countDocuments({
      category: categoryId,
      isDeleted: false
    });

    if (competitionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${competitionCount} active competitions. Please move or delete competitions first.`
      });
    }

    // Soft delete
    await category.softDelete();

    // Invalidate cache
    await cacheService.delete(CACHE_KEYS.ALL_CATEGORIES);
    await cacheService.delete(`${CACHE_KEYS.CATEGORY_PREFIX}${categoryId}`);

    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// REORDER CATEGORIES
// =============================================================================

/**
 * @desc    Reorder categories
 * @route   PUT /api/admin/categories/reorder
 * @access  Admin
 */
const reorderCategories = async (req, res) => {
  try {
    const { orders } = req.body; // [{ id: '...', displayOrder: 1 }, ...]

    if (!Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message: 'Orders must be an array'
      });
    }

    // Update all categories in parallel
    const updates = orders.map(({ id, displayOrder }) =>
      Category.findByIdAndUpdate(id, { displayOrder, updatedBy: req.user.id })
    );

    await Promise.all(updates);

    // Invalidate cache
    await cacheService.delete(CACHE_KEYS.ALL_CATEGORIES);

    return res.status(200).json({
      success: true,
      message: 'Categories reordered successfully'
    });

  } catch (error) {
    console.error('Reorder categories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  reorderCategories
};
