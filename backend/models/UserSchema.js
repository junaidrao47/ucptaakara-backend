/**
 * =============================================================================
 * USER SCHEMA MODEL
 * =============================================================================
 * Mongoose schema definition for User documents in MongoDB
 * 
 * Features:
 * - Automatic password hashing with bcrypt (10 rounds)
 * - Role-based access control (user, admin, support)
 * - Google OAuth support with googleId field
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
 *   findByGoogleId(googleId)        - Find user by Google ID
 *   verifyCredentials(email, pass)  - Verify login credentials
 *   findOrCreateGoogleUser(profile) - Find or create Google OAuth user
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
      required: function() {
        // Password required only if not using OAuth
        return !this.googleId;
      },
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
        values: ['user', 'admin', 'support'],
        message: 'Role must be one of: user, admin, support'
      },
      default: 'user',
      lowercase: true
    },
    // Google OAuth fields
    googleId: {
      type: String,
      unique: true,
      sparse: true // Allows null values while maintaining uniqueness
    },
    avatar: {
      type: String,
      default: null
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
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
  // Skip if no password or password not modified
  if (!this.password || !this.isModified('password')) {
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
  if (!this.password) return false;
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

/**
 * @desc    Find user by Google ID
 * @param   {string} googleId - Google OAuth ID
 * @returns {Promise<Object|null>} User document or null
 */
userSchema.statics.findByGoogleId = async function (googleId) {
  return await this.findOne({ googleId });
};

/**
 * @desc    Find or create user from Google OAuth profile
 * @param   {Object} profile - Google OAuth profile
 * @returns {Promise<Object>} User document
 */
userSchema.statics.findOrCreateGoogleUser = async function (profile) {
  // Try to find existing user by googleId
  let user = await this.findOne({ googleId: profile.id });
  
  if (user) {
    // Update last login and return existing user
    user.lastLogin = new Date();
    await user.save();
    return user;
  }

  // Try to find user by email (might have registered locally)
  user = await this.findOne({ email: profile.emails[0].value.toLowerCase() });
  
  if (user) {
    // Link Google account to existing local account
    user.googleId = profile.id;
    user.authProvider = 'google';
    if (profile.photos && profile.photos[0]) {
      user.avatar = profile.photos[0].value;
    }
    user.lastLogin = new Date();
    await user.save();
    return user;
  }

  // Create new user from Google profile
  const newUser = await this.create({
    googleId: profile.id,
    email: profile.emails[0].value.toLowerCase(),
    name: profile.displayName || `${profile.name.givenName} ${profile.name.familyName}`,
    avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
    authProvider: 'google',
    role: 'user',
    lastLogin: new Date()
  });

  return newUser;
};

// Create and export the model
module.exports = mongoose.model('User', userSchema);
