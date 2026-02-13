/**
 * =============================================================================
 * USER ROUTES
 * =============================================================================
 * All routes related to user management
 * 
 * Base path: /api/users
 * 
 * PROTECTED ROUTES (require JWT token):
 * GET  /api/users/me              - Get current user profile
 * GET  /api/users/profile         - Get current user profile (alias)
 * PUT  /api/users/update          - Update current user profile
 * PUT  /api/users/profile         - Update current user profile (alias)
 * 
 * ADMIN ROUTES (require JWT token + admin role):
 * GET  /api/users                 - Get all users
 * GET  /api/users/allusers        - Get all users (alias)
 * GET  /api/users/:id             - Get user by ID
 * GET  /api/users/userprofile/:id - Get user by ID (alias)
 * PUT  /api/users/:id/role        - Update user role
 * DELETE /api/users/:id           - Delete user
 * =============================================================================
 */

const express = require('express');
const router = express.Router();

// Import controller
const userController = require('../controllers/userController');

// Import middleware
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roleCheck');
const { cacheMiddleware } = require('../middleware/cache');

// =============================================================================
// PROTECTED ROUTES (Any Authenticated User)
// =============================================================================

/**
 * @route   GET /api/users/me
 * @desc    Get current user's profile
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @cache   10 minutes
 */
router.get('/me', authenticate, cacheMiddleware(600), userController.getUserProfile);

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile (alias for /me)
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @cache   10 minutes
 */
router.get('/profile', authenticate, cacheMiddleware(600), userController.getUserProfile);

/**
 * @route   PUT /api/users/update
 * @desc    Update current user's profile
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @body    { name?, email? }
 */
router.put('/update', authenticate, userController.updateProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile (alias for /update)
 * @access  Private
 * @header  Authorization: Bearer <token>
 * @body    { name?, email? }
 */
router.put('/profile', authenticate, userController.updateProfile);

// =============================================================================
// ADMIN ROUTES (Require Admin Role)
// =============================================================================

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Admin only)
 * @header  Authorization: Bearer <admin-token>
 * @cache   5 minutes
 */
router.get('/', authenticate, authorize('admin'), cacheMiddleware(300), userController.getAllUsers);

/**
 * @route   GET /api/users/allusers
 * @desc    Get all users (alias)
 * @access  Private (Admin only)
 * @header  Authorization: Bearer <admin-token>
 * @cache   5 minutes
 */
router.get('/allusers', authenticate, authorize('admin'), cacheMiddleware(300), userController.getAllUsers);

/**
 * @route   GET /api/users/userprofile/:id
 * @desc    Get user profile by ID
 * @access  Private (Admin only)
 * @header  Authorization: Bearer <admin-token>
 * @param   id - User's MongoDB ObjectId
 */
router.get('/userprofile/:id', authenticate, authorize('admin'), userController.getUserById);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 * @header  Authorization: Bearer <admin-token>
 * @param   id - User's MongoDB ObjectId
 */
router.get('/:id', authenticate, authorize('admin'), userController.getUserById);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user's role
 * @access  Private (Admin only)
 * @header  Authorization: Bearer <admin-token>
 * @param   id - User's MongoDB ObjectId
 * @body    { role: 'user' | 'moderator' | 'admin' }
 */
router.put('/:id/role', authenticate, authorize('admin'), userController.updateUserRole);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin only)
 * @header  Authorization: Bearer <admin-token>
 * @param   id - User's MongoDB ObjectId
 */
router.delete('/:id', authenticate, authorize('admin'), userController.deleteUser);

module.exports = router;
