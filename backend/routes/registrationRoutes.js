/**
 * =============================================================================
 * REGISTRATION ROUTES
 * =============================================================================
 * Routes for user registration management
 * Base path: /api/registrations
 * 
 * All routes require authentication
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const authenticate = require('../middleware/auth');
const { registrationValidation } = require('../middleware/validators');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/registrations/my
 * @desc    Get current user's registrations
 * @access  Private
 * @query   status, page, limit
 */
router.get('/my', registrationValidation.query, registrationController.getMyRegistrations);

/**
 * @route   GET /api/registrations/check/:competitionId
 * @desc    Check if user is registered for a competition
 * @access  Private
 */
router.get('/check/:competitionId', registrationController.checkRegistrationStatus);

/**
 * @route   GET /api/registrations/code/:code
 * @desc    Get registration by confirmation code
 * @access  Private
 */
router.get('/code/:code', registrationController.getByConfirmationCode);

/**
 * @route   GET /api/registrations/:id
 * @desc    Get registration details
 * @access  Private (owner only)
 */
router.get('/:id', registrationValidation.paramId, registrationController.getRegistrationById);

/**
 * @route   POST /api/registrations/:competitionId
 * @desc    Register for a competition
 * @access  Private
 */
router.post('/:competitionId', registrationValidation.create, registrationController.registerForCompetition);

/**
 * @route   PATCH /api/registrations/:id/cancel
 * @desc    Cancel a registration
 * @access  Private (owner only)
 */
router.patch('/:id/cancel', registrationValidation.paramId, registrationController.cancelRegistration);

/**
 * @route   POST /api/registrations/:id/submit
 * @desc    Submit project for hackathon
 * @access  Private (owner only)
 */
router.post('/:id/submit', registrationValidation.submission, registrationController.submitProject);

module.exports = router;
