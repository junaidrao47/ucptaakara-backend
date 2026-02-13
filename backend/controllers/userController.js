/**
 * =============================================================================
 * USER CONTROLLER
 * =============================================================================
 * Handles all user-related business logic
 * 
 * Methods:
 * - getUserProfile     : Get current user's profile
 * - getUserById        : Get user by ID (admin only)
 * - updateProfile      : Update current user's profile
 * - getAllUsers        : Get all users (admin only)
 * - updateUserRole     : Update user role (admin only)
 * - deleteUser         : Delete a user (admin only)
 * =============================================================================
 */

const { db } = require('../config/database');
const { validateName, validateEmail } = require('../utils/validation');
const { clearUserCache, clearRouteCache } = require('../middleware/cache');

/**
 * @desc    Get current user's profile
 * @route   GET /api/users/me
 * @route   GET /api/users/profile
 * @access  Private (requires authentication)
 */
const getUserProfile = async (req, res) => {
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
    console.error('GetUserProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @route   GET /api/users/userprofile/:id
 * @access  Private (admin only)
 */
const getUserById = async (req, res) => {
  try {
    const user = await db.findUserById(req.params.id);
    
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
    console.error('GetUserById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update current user's profile
 * @route   PUT /api/users/update
 * @route   PUT /api/users/profile
 * @access  Private (requires authentication)
 */
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;
    
    // Prepare updates object
    const updates = {};

    // Validate and add name if provided
    if (name !== undefined) {
      const nameValidation = validateName(name);
      if (!nameValidation.valid) {
        return res.status(400).json({
          success: false,
          message: nameValidation.message
        });
      }
      updates.name = name.trim();
    }

    // Validate and add email if provided
    if (email !== undefined) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return res.status(400).json({
          success: false,
          message: emailValidation.message
        });
      }

      // Check if new email is already in use by another user
      if (email.toLowerCase() !== req.user.email) {
        const existingUser = await db.findUserByEmail(email);
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Email already in use'
          });
        }
      }
      updates.email = email.toLowerCase();
    }

    // Ensure updates object is not empty
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update. Provide name or email.'
      });
    }

    // Update user in database
    const updatedUser = await db.updateUser(userId, updates);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Clear user's cache
    await clearUserCache(userId);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser._id ? updatedUser._id.toString() : updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        updatedAt: updatedUser.updatedAt
      }
    });

  } catch (error) {
    console.error('UpdateProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @route   GET /api/users/allusers
 * @access  Private (admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await db.getAllUsers();
    
    const safeUsers = users.map(user => ({
      id: user._id ? user._id.toString() : user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    return res.status(200).json({
      success: true,
      count: safeUsers.length,
      data: safeUsers
    });

  } catch (error) {
    console.error('GetAllUsers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update user role
 * @route   PUT /api/users/:id/role
 * @access  Private (admin only)
 */
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.id;
    const validRoles = ['user', 'moderator', 'admin'];

    // Validate role
    if (!role || !validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${validRoles.join(', ')}`
      });
    }

    // Prevent admin from changing their own role
    if (targetUserId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }

    // Update user role in database
    const user = await db.updateUser(targetUserId, {
      role: role.toLowerCase()
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Clear caches
    await clearUserCache(targetUserId);
    await clearRouteCache('/api/users');

    return res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: {
        id: user._id ? user._id.toString() : user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('UpdateUserRole error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/users/:id
 * @access  Private (admin only)
 */
const deleteUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    // Prevent admin from deleting themselves
    if (targetUserId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Delete user from database
    const deleted = await db.deleteUser(targetUserId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Clear caches
    await clearUserCache(targetUserId);
    await clearRouteCache('/api/users');

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('DeleteUser error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Export all controller methods
module.exports = {
  getUserProfile,
  getUserById,
  updateProfile,
  getAllUsers,
  updateUserRole,
  deleteUser
};
