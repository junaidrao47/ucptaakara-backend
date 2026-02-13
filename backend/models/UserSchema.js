/**
 * =============================================================================
 * USER SCHEMA MODEL
 * =============================================================================
 * Mongoose schema definition for User documents in MongoDB
 * 
 * Features:
 * - Automatic password hashing with bcrypt (10 rounds)
 * - Role-based access control (user, moderator, admin)
 * - Email validation and normalization
 * - Password excluded from queries by default
 * - Automatic timestamps (createdAt, updatedAt)
 * 
 * Instance Methods:
 *   comparePassword(password) - Compare plain password with hashed
 *   toSafeObject()            - Get user without sensitive fields
 *   updateLastLogin()         - Update lastLogin timestamp
 * 
 * Static Methods:
 *   findByEmail(email)              - Find user by email
 *   verifyCredentials(email, pass)  - Verify login credentials
 * 
 * Usage:
 *   const User = require('./models/UserSchema');
 *   const user = await User.create({ email, password, name });
 *   const isValid = await user.comparePassword('plaintext');
 * =============================================================================
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema Definition
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [100, 'Email cannot exceed 100 characters'],
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      maxlength: [100, 'Password cannot exceed 100 characters'],
      select: false // Don't include password in queries by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
      trim: true
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'moderator', 'admin'],
        message: 'Role must be one of: user, moderator, admin'
      },
      default: 'user',
      lowercase: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true // Adds createdAt and updatedAt fields automatically
  }
);

/**
 * Pre-save Hook: Hash Password
 * Only hashes if password field is new or modified
 */
userSchema.pre('save', async function (next) {
  // Only hash password if it's new or been modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Compare plain text password with hashed password
 * @param   {string} plainPassword - Plain text password to verify
 * @returns {Promise<boolean>} True if passwords match
 */
userSchema.methods.comparePassword = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

/**
 * @desc    Get user object without sensitive fields
 * @returns {Object} User object without password
 */
userSchema.methods.toSafeObject = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

/**
 * @desc    Update user's last login timestamp
 * @returns {Promise<void>}
 */
userSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  await this.save();
};

/**
 * @desc    Find user by email address
 * @param   {string} email - User's email address
 * @returns {Promise<Object|null>} User document or null
 */
userSchema.statics.findByEmail = async function (email) {
  return await this.findOne({ email: email.toLowerCase() });
};

/**
 * @desc    Verify user credentials for login
 * @param   {string} email - User's email address
 * @param   {string} password - Plain text password
 * @returns {Promise<Object|null>} User object if valid, null otherwise
 */
userSchema.statics.verifyCredentials = async function (email, password) {
  const user = await this.findOne({ email: email.toLowerCase() }).select('+password');
  
  if (!user) {
    return null;
  }

  const isPasswordValid = await user.comparePassword(password);
  
  if (!isPasswordValid) {
    return null;
  }

  return user;
};

// Create and export the model
module.exports = mongoose.model('User', userSchema);
