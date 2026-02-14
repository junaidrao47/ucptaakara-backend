/**
 * =============================================================================
 * PUBLIC CATEGORY ROUTES
 * =============================================================================
 * Routes for public category browsing
 * Base path: /api/categories
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

/**
 * @route   GET /api/categories
 * @desc    Get all active categories
 * @access  Public
 */
router.get('/', categoryController.getCategories);

/**
 * @route   GET /api/categories/:slug
 * @desc    Get category by slug
 * @access  Public
 */
router.get('/:slug', categoryController.getCategoryBySlug);

module.exports = router;
