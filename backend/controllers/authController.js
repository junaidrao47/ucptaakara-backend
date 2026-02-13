/**
 * =============================================================================
 * AUTH CONTROLLER
 * =============================================================================
 * Handles all authentication-related business logic
 * 
 * Methods:
 * - signup    : Register new user
 * - login     : Authenticate user and return JWT
 * - logout    : Invalidate user session
 * - getMe     : Get current authenticated user
 * =============================================================================
 */

const { db } = require('../config/database');
const { generateToken } = require('../utils/tokenGenerator');
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

    // Generate JWT token
    const token = generateToken({
      id: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role
    });

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
        token
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

    // Update last login timestamp
    await user.updateLastLogin();

    // Generate JWT token
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role
    });

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
          lastLogin: user.lastLogin
        },
        token
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

// Export all controller methods
module.exports = {
  signup,
  login,
  logout,
  getMe
};
