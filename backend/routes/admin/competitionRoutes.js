/**
 * =============================================================================
 * ADMIN COMPETITION ROUTES
 * =============================================================================
 * Routes for admin competition management
 * Base path: /api/admin/competitions
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const competitionController = require('../../controllers/admin/competitionController');
const { competitionValidation } = require('../../middleware/validators');
const { uploadCompetitionImages, handleUploadError } = require('../../middleware/upload');

/**
 * @route   POST /api/admin/competitions
 * @desc    Create a new competition (with optional cover and gallery images)
 * @access  Admin
 */
router.post('/', uploadCompetitionImages, handleUploadError, competitionValidation.create, competitionController.createCompetition);

/**
 * @route   GET /api/admin/competitions
 * @desc    Get all competitions with full details
 * @access  Admin
 */
router.get('/', competitionController.getAllCompetitions);

/**
 * @route   GET /api/admin/competitions/:id
 * @desc    Get competition by ID with stats
 * @access  Admin
 */
router.get('/:id', competitionValidation.paramId, competitionController.getCompetitionById);

/**
 * @route   PUT /api/admin/competitions/:id
 * @desc    Update competition (with optional cover and gallery images)
 * @access  Admin
 */
router.put('/:id', uploadCompetitionImages, handleUploadError, competitionValidation.update, competitionController.updateCompetition);

/**
 * @route   DELETE /api/admin/competitions/:id
 * @desc    Delete competition (soft delete)
 * @access  Admin
 */
router.delete('/:id', competitionValidation.paramId, competitionController.deleteCompetition);

/**
 * @route   PATCH /api/admin/competitions/:id/publish
 * @desc    Publish a draft competition
 * @access  Admin
 */
router.patch('/:id/publish', competitionValidation.paramId, competitionController.publishCompetition);

/**
 * @route   PATCH /api/admin/competitions/:id/feature
 * @desc    Toggle featured status
 * @access  Admin
 */
router.patch('/:id/feature', competitionValidation.paramId, competitionController.toggleFeatured);

/**
 * @route   POST /api/admin/competitions/:id/duplicate
 * @desc    Duplicate a competition
 * @access  Admin
 */
router.post('/:id/duplicate', competitionValidation.paramId, competitionController.duplicateCompetition);

/**
 * @route   GET /api/admin/competitions/:id/registrations
 * @desc    Get registrations for a competition
 * @access  Admin
 */
router.get('/:id/registrations', competitionValidation.paramId, competitionController.getCompetitionRegistrations);

module.exports = router;
