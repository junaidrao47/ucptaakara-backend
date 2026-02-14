/**
 * =============================================================================
 * PUBLIC COMPETITION ROUTES
 * =============================================================================
 * Routes for public competition browsing
 * Base path: /api/competitions
 * 
 * Features:
 * - List with filters (category, search, sort, date range)
 * - Featured and trending
 * - Calendar view
 * - Competition details
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const competitionController = require('../controllers/competitionController');
const { competitionValidation } = require('../middleware/validators');

/**
 * @route   GET /api/competitions
 * @desc    Get competitions with advanced filtering
 * @access  Public
 * @query   category, search, sort, startDate, endDate, type, isOnline, featured, active, page, limit
 */
router.get('/', competitionValidation.query, competitionController.getCompetitions);

/**
 * @route   GET /api/competitions/featured
 * @desc    Get featured competitions
 * @access  Public
 */
router.get('/featured', competitionController.getFeaturedCompetitions);

/**
 * @route   GET /api/competitions/trending
 * @desc    Get trending competitions
 * @access  Public
 */
router.get('/trending', competitionController.getTrendingCompetitions);

/**
 * @route   GET /api/competitions/calendar
 * @desc    Get competitions for calendar view
 * @access  Public
 * @query   month (1-12), year
 */
router.get('/calendar', competitionValidation.calendar, competitionController.getCalendarCompetitions);

/**
 * @route   GET /api/competitions/upcoming
 * @desc    Get upcoming competitions
 * @access  Public
 * @query   limit, category
 */
router.get('/upcoming', competitionController.getUpcomingCompetitions);

/**
 * @route   GET /api/competitions/suggestions
 * @desc    Get search suggestions for autocomplete
 * @access  Public
 * @query   q (search query)
 */
router.get('/suggestions', competitionController.getSearchSuggestions);

/**
 * @route   GET /api/competitions/:identifier
 * @desc    Get competition by ID or slug
 * @access  Public
 */
router.get('/:identifier', competitionController.getCompetitionByIdentifier);

/**
 * @route   GET /api/competitions/:id/related
 * @desc    Get related competitions
 * @access  Public
 */
router.get('/:id/related', competitionController.getRelatedCompetitions);

module.exports = router;
