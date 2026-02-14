/**
 * =============================================================================
 * AUTH CONTROLLER
 * =============================================================================
 * Handles all authentication-related business logic
 * 
 * Methods:
 * - signup         : Register new user
 * - login          : Authenticate user and return JWT tokens
 * - logout         : Invalidate user session
 * - refreshToken   : Get new access token using refresh token
 * - getMe          : Get current authenticated user
 * - googleCallback : Handle Google OAuth callback
 * =============================================================================
 */

const { db } = require('../config/database');
const { 
  generateToken, 
  generateTokenPair, 
  generateAccessToken,
  verifyRefreshToken 
} = require('../utils/tokenGenerator');
const { validateRegisterInput, validateLoginInput } = require('../utils/validation');
const cacheService = require('../config/cache');
const UserModel = require('../models/UserSchema');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/signup
 * @route   POST /api/auth/register
 * @access  Public
 */
const signup = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Validate input
    const validation = validateRegisterInput(email, password, name, role);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Check if user already exists
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user in database (password is hashed in schema pre-save hook)
    const newUser = await db.createUser({
      email: email.toLowerCase(),
      password: password,
      name: name.trim(),
      role: role ? role.toLowerCase() : 'user'
    });

    // Generate token pair (access + refresh)
    const tokens = generateTokenPair({
      id: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role
    });

    // Store refresh token in cache for validation
    if (cacheService.isConnected()) {
      await cacheService.set(
        `refresh:${newUser._id.toString()}`,
        tokens.refreshToken,
        604800 // 7 days
      );
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser._id.toString(),
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          createdAt: newUser.createdAt
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Login user and return JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const validation = validateLoginInput(email, password);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Verify credentials using the schema static method
    const user = await UserModel.verifyCredentials(email, password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Contact support.'
      });
    }

    // Update last login timestamp
    await user.updateLastLogin();

    // Generate token pair (access + refresh)
    const tokens = generateTokenPair({
      id: user._id.toString(),
      email: user.email,
      role: user.role
    });

    // Store refresh token in cache for validation
    if (cacheService.isConnected()) {
      await cacheService.set(
        `refresh:${user._id.toString()}`,
        tokens.refreshToken,
        604800 // 7 days
      );
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          authProvider: user.authProvider || 'local',
          lastLogin: user.lastLogin
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Logout user (invalidate token in cache)
 * @route   POST /api/auth/logout
 * @access  Private (requires authentication)
 */
const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    const token = req.headers.authorization?.split(' ')[1];

    // Add token to blacklist in Redis (optional: for complete token invalidation)
    if (token && cacheService.isConnected()) {
      // Store blacklisted token with TTL matching token expiration
      const tokenKey = `blacklist:${token}`;
      await cacheService.set(tokenKey, 'blacklisted', 604800); // 7 days TTL
    }

    // Clear user's cached data
    const cacheKey = `cache:${userId}:*`;
    if (cacheService.isConnected()) {
      await cacheService.del(`cache:${userId}:/api/users/me`);
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get current authenticated user
 * @route   GET /api/auth/me
 * @access  Private (requires authentication)
 */
const getMe = async (req, res) => {
  try {
    const user = await db.findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user._id ? user._id.toString() : user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        authProvider: user.authProvider,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Handle Google OAuth callback
 * @route   GET /api/auth/google/callback
 * @access  Public (called by Google after authentication)
 */
const googleCallback = async (req, res) => {
  try {
    // User is attached to req by Passport after successful authentication
    const user = req.user;

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=authentication_failed`);
    }

    // Generate token pair
    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    };
    const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

    // Store refresh token in Redis cache
    await cache.set(`refresh:${user._id}`, refreshToken, 604800); // 7 days TTL

    // Redirect to frontend with tokens
    // Frontend should extract tokens from URL and store them
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(
      `${frontendURL}/oauth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`
    );

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendURL}/login?error=oauth_error`);
  }
};

/**
 * @desc    Google OAuth callback returning JSON (for API testing)
 * @route   GET /api/auth/google/callback/json
 * @access  Public
 */
const googleCallbackJson = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Google authentication failed'
      });
    }

    // Generate token pair
    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    };
    const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

    // Store refresh token in Redis cache
    await cache.set(`refresh:${user._id}`, refreshToken, 604800); // 7 days TTL

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          authProvider: user.authProvider
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Google OAuth JSON callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Google authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Refresh access token using refresh token
 * @route   POST /api/auth/refresh
 * @access  Public
 * 
 * @param {Object} req.body
 * @param {string} req.body.refreshToken - The refresh token to validate
 * 
 * @returns {Object} Response with new access token
 * @returns {boolean} response.success - Operation success status
 * @returns {string} response.message - Response message
 * @returns {Object} response.data - Contains new accessToken
 * 
 * @example
 * // Request body:
 * { "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * 
 * // Success response:
 * {
 *   "success": true,
 *   "message": "Token refreshed successfully",
 *   "data": {
 *     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *   }
 * }
 */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    // Validate refresh token is provided
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify the refresh token
    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Check if refresh token exists in cache (not revoked)
    const cachedToken = await cache.get(`refresh:${decoded.id}`);
    if (!cachedToken || cachedToken !== token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked'
      });
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.id).select('email role isActive');
    if (!user) {
      // Clean up orphaned token
      await cache.delete(`refresh:${decoded.id}`);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      // Clean up token for deactivated user
      await cache.delete(`refresh:${decoded.id}`);
      return res.status(403).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role
    });

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Revoke refresh token (logout from all devices)
 * @route   POST /api/auth/revoke
 * @access  Private
 * 
 * @returns {Object} Response confirming token revocation
 * @returns {boolean} response.success - Operation success status
 * @returns {string} response.message - Response message
 */
const revokeToken = async (req, res) => {
  try {
    const userId = req.user.id;

    // Remove refresh token from cache
    await cache.delete(`refresh:${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Refresh token revoked successfully'
    });

  } catch (error) {
    console.error('Token revocation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Export all controller methods
module.exports = {
  signup,
  login,
  logout,
  getMe,
  googleCallback,
  googleCallbackJson,
  refreshAccessToken,
  revokeToken
};
