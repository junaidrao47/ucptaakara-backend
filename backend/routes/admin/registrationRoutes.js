/**
 * =============================================================================
 * ADMIN REGISTRATION ROUTES
 * =============================================================================
 * Routes for admin registration management
 * Base path: /api/admin/registrations
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const registrationController = require('../../controllers/admin/registrationController');
const { registrationValidation } = require('../../middleware/validators');

/**
 * @route   GET /api/admin/registrations
 * @desc    Get all registrations across all competitions
 * @access  Admin
 */
router.get('/', registrationValidation.query, registrationController.getAllRegistrations);

/**
 * @route   POST /api/admin/registrations/bulk-approve
 * @desc    Bulk approve multiple registrations
 * @access  Admin
 */
router.post('/bulk-approve', registrationController.bulkApprove);

/**
 * @route   POST /api/admin/registrations/bulk-reject
 * @desc    Bulk reject multiple registrations
 * @access  Admin
 */
router.post('/bulk-reject', registrationController.bulkReject);

/**
 * @route   GET /api/admin/registrations/:id
 * @desc    Get registration details
 * @access  Admin
 */
router.get('/:id', registrationValidation.paramId, registrationController.getRegistrationById);

/**
 * @route   PATCH /api/admin/registrations/:id
 * @desc    Update registration (notes, score, position)
 * @access  Admin
 */
router.patch('/:id', registrationValidation.paramId, registrationController.updateRegistration);

/**
 * @route   PATCH /api/admin/registrations/:id/approve
 * @desc    Approve a pending registration
 * @access  Admin
 */
router.patch('/:id/approve', registrationValidation.approve, registrationController.approveRegistration);

/**
 * @route   PATCH /api/admin/registrations/:id/reject
 * @desc    Reject a pending registration
 * @access  Admin
 */
router.patch('/:id/reject', registrationValidation.reject, registrationController.rejectRegistration);

module.exports = router;
