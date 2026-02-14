/**
 * =============================================================================
 * ADMIN ANALYTICS ROUTES
 * =============================================================================
 * Routes for admin dashboard analytics
 * Base path: /api/admin/analytics
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/admin/analyticsController');

/**
 * @route   GET /api/admin/analytics/dashboard
 * @desc    Get dashboard overview statistics
 * @access  Admin
 */
router.get('/dashboard', analyticsController.getDashboardStats);

/**
 * @route   GET /api/admin/analytics/realtime
 * @desc    Get real-time statistics
 * @access  Admin
 */
router.get('/realtime', analyticsController.getRealtimeStats);

/**
 * @route   GET /api/admin/analytics/users/growth
 * @desc    Get user growth data for charts
 * @access  Admin
 * @query   period - 7d, 30d, 90d, 1y
 */
router.get('/users/growth', analyticsController.getUserGrowth);

/**
 * @route   GET /api/admin/analytics/registrations/trends
 * @desc    Get registration trends for charts
 * @access  Admin
 * @query   period - 7d, 30d, 90d
 */
router.get('/registrations/trends', analyticsController.getRegistrationTrends);

/**
 * @route   GET /api/admin/analytics/categories/performance
 * @desc    Get category performance analytics
 * @access  Admin
 */
router.get('/categories/performance', analyticsController.getCategoryPerformance);

/**
 * @route   GET /api/admin/analytics/competitions
 * @desc    Get competition analytics
 * @access  Admin
 * @query   period - 7d, 30d, 90d
 */
router.get('/competitions', analyticsController.getCompetitionAnalytics);

module.exports = router;
