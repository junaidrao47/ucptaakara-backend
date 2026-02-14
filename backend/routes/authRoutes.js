/**
 * =============================================================================
 * AUTHENTICATION ROUTES
 * =============================================================================
 * All routes related to user authentication
 * 
 * Base path: /api/auth
 * 
 * PUBLIC ROUTES:
 * POST /api/auth/signup           - Register new user
 * POST /api/auth/register         - Register new user (alias)
 * POST /api/auth/login            - Login and get JWT tokens
 * POST /api/auth/refresh          - Refresh access token
 * GET  /api/auth/google           - Initiate Google OAuth
 * GET  /api/auth/google/callback  - Google OAuth callback
 * 
 * PROTECTED ROUTES (require JWT token):
 * POST /api/auth/logout           - Logout and invalidate token
 * POST /api/auth/revoke           - Revoke refresh token
 * GET  /api/auth/me               - Get current authenticated user
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');

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

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken }
 */
router.post('/refresh', authController.refreshAccessToken);

// =============================================================================
// GOOGLE OAUTH ROUTES
// =============================================================================

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth authentication
 * @access  Public
 * @note    Redirects user to Google login page
 */
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false
  })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback - redirects to frontend with token
 * @access  Public (called by Google)
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/api/auth/google/failure',
    session: false
  }),
  authController.googleCallback
);

/**
 * @route   GET /api/auth/google/callback/json
 * @desc    Google OAuth callback - returns JSON response (for testing)
 * @access  Public
 */
router.get('/google/callback/json',
  passport.authenticate('google', { 
    failureRedirect: '/api/auth/google/failure',
    session: false
  }),
  authController.googleCallbackJson
);

/**
 * @route   GET /api/auth/google/failure
 * @desc    Google OAuth failure handler
 * @access  Public
 */
router.get('/google/failure', (req, res) => {
  return res.status(401).json({
    success: false,
    message: 'Google authentication failed'
  });
});

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
 * @route   POST /api/auth/revoke
 * @desc    Revoke refresh token (logout from all sessions)
 * @access  Private
 * @header  Authorization: Bearer <token>
 */
router.post('/revoke', authenticate, authController.revokeToken);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user data
 * @access  Private
 * @header  Authorization: Bearer <token>
 */
router.get('/me', authenticate, authController.getMe);

module.exports = router;
