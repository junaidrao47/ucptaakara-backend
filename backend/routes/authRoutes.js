/**
 * =============================================================================
 * AUTHENTICATION ROUTES
 * =============================================================================
 * All routes related to user authentication
 * 
 * Base path: /api/auth
 * 
 * PUBLIC ROUTES:
 * POST /api/auth/signup     - Register new user
 * POST /api/auth/register   - Register new user (alias)
 * POST /api/auth/login      - Login and get JWT token
 * 
 * PROTECTED ROUTES (require JWT token):
 * POST /api/auth/logout     - Logout and invalidate token
 * GET  /api/auth/me         - Get current authenticated user
 * =============================================================================
 */

const express = require('express');
const router = express.Router();

// Import controller
const authController = require('../controllers/authController');

// Import middleware
const authenticate = require('../middleware/auth');

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user account
 * @access  Public
 * @body    { email, password, name, role? }
 */
router.post('/signup', authController.signup);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account (alias for /signup)
 * @access  Public
 * @body    { email, password, name, role? }
 */
router.post('/register', authController.signup);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', authController.login);

// =============================================================================
// PROTECTED ROUTES (Require Authentication)
// =============================================================================

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate token
 * @access  Private
 * @header  Authorization: Bearer <token>
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user data
 * @access  Private
 * @header  Authorization: Bearer <token>
 */
router.get('/me', authenticate, authController.getMe);

module.exports = router;
