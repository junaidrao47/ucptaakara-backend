/**
 * =============================================================================
 * DASHBOARD ROUTES
 * =============================================================================
 * User dashboard endpoints
 * Base path: /api/dashboard
 * 
 * GET /api/dashboard              - Dashboard overview
 * GET /api/dashboard/competitions - User's registered competitions
 * GET /api/dashboard/activity     - Activity timeline
 * GET /api/dashboard/deadlines    - Upcoming deadlines
 * GET /api/dashboard/stats        - Detailed statistics
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const {
  getDashboardOverview,
  getMyCompetitions,
  getActivityTimeline,
  getDeadlines,
  getStats
} = require('../controllers/dashboardController');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/dashboard
 * @desc    Get dashboard overview with stats and summaries
 * @access  Private
 */
router.get('/', getDashboardOverview);

/**
 * @route   GET /api/dashboard/competitions
 * @desc    Get user's registered competitions
 * @query   status (pending|approved|rejected|cancelled|completed)
 * @query   timeframe (upcoming|ongoing|past)
 * @query   page, limit
 * @access  Private
 */
router.get('/competitions', getMyCompetitions);

/**
 * @route   GET /api/dashboard/activity
 * @desc    Get activity timeline
 * @query   page, limit
 * @access  Private
 */
router.get('/activity', getActivityTimeline);

/**
 * @route   GET /api/dashboard/deadlines
 * @desc    Get upcoming deadlines
 * @query   limit
 * @access  Private
 */
router.get('/deadlines', getDeadlines);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get detailed stats for dashboard widgets
 * @access  Private
 */
router.get('/stats', getStats);

module.exports = router;
