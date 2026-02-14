/**
 * =============================================================================
 * ADMIN CATEGORY ROUTES
 * =============================================================================
 * Routes for admin category management
 * Base path: /api/admin/categories
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/admin/categoryController');
const { categoryValidation } = require('../../middleware/validators');
const { uploadCategoryImages, handleUploadError } = require('../../middleware/upload');

/**
 * @route   POST /api/admin/categories
 * @desc    Create a new category (with optional icon and banner images)
 * @access  Admin
 */
router.post('/', uploadCategoryImages, handleUploadError, categoryValidation.create, categoryController.createCategory);

/**
 * @route   GET /api/admin/categories
 * @desc    Get all categories with full details
 * @access  Admin
 */
router.get('/', categoryController.getAllCategories);

/**
 * @route   PUT /api/admin/categories/reorder
 * @desc    Reorder categories
 * @access  Admin
 */
router.put('/reorder', categoryController.reorderCategories);

/**
 * @route   GET /api/admin/categories/:id
 * @desc    Get category by ID
 * @access  Admin
 */
router.get('/:id', categoryValidation.paramId, categoryController.getCategoryById);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Update category (with optional icon and banner images)
 * @access  Admin
 */
router.put('/:id', uploadCategoryImages, handleUploadError, categoryValidation.update, categoryController.updateCategory);

/**
 * @route   DELETE /api/admin/categories/:id
 * @desc    Delete category (soft delete)
 * @access  Admin
 */
router.delete('/:id', categoryValidation.paramId, categoryController.deleteCategory);

module.exports = router;
