/**
 * =============================================================================
 * SUPPORT ROUTES
 * =============================================================================
 * Routes for support staff functionality
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  searchUsers,
  getUserRegistrations,
  getDashboardStats
} = require('../controllers/supportController');

// All routes require authentication and support or higher role
router.use(authenticate);
router.use(authorize('support', 'admin'));

/**
 * @route   GET /api/support/dashboard
 * @desc    Get support dashboard stats
 * @access  Support
 */
router.get('/dashboard', getDashboardStats);

/**
 * @route   GET /api/support/registrations/pending
 * @desc    Get pending registrations for review
 * @query   page, limit, search, competition
 * @access  Support
 */
router.get('/registrations/pending', getPendingRegistrations);

/**
 * @route   PATCH /api/support/registrations/:id/approve
 * @desc    Approve a pending registration
 * @access  Support
 */
router.patch('/registrations/:id/approve', approveRegistration);

/**
 * @route   PATCH /api/support/registrations/:id/reject
 * @desc    Reject a pending registration
 * @body    { reason: "string" }
 * @access  Support
 */
router.patch('/registrations/:id/reject', rejectRegistration);

/**
 * @route   GET /api/support/users/search
 * @desc    Search for users
 * @query   q (required, min 2 chars), page, limit
 * @access  Support
 */
router.get('/users/search', searchUsers);

/**
 * @route   GET /api/support/users/:userId/registrations
 * @desc    Get user's registrations
 * @access  Support
 */
router.get('/users/:userId/registrations', getUserRegistrations);

module.exports = router;
