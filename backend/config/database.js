/**
 * =============================================================================
 * DATABASE CONFIGURATION
 * =============================================================================
 * MongoDB connection management and database operations using Mongoose
 * 
 * Features:
 * - Connection pooling with automatic reconnection
 * - Database class with CRUD operations for users
 * - Environment-based configuration
 * 
 * Environment Variables:
 *   MONGO_URI - MongoDB connection string
 *               Default: mongodb://localhost:27017/ucp_takra
 *               Docker:  mongodb://mongo:mongo123@mongodb:27017/ucp_takra?authSource=admin
 * 
 * Usage:
 *   const { connectDB, db } = require('./config/database');
 *   await connectDB();
 *   const user = await db.findUserByEmail('test@example.com');
 * =============================================================================
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ucp_takra';

/**
 * @desc    Connect to MongoDB database
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ MongoDB connected successfully');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

/**
 * @desc    Disconnect from MongoDB database
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('✓ MongoDB disconnected');
  } catch (error) {
    console.error('✗ MongoDB disconnection failed:', error.message);
  }
};

/**
 * Database Operations Class
 * Provides abstraction layer for user-related database operations
 */
class Database {
  constructor() {
    this.UserModel = require('../models/UserSchema');
  }

  /**
   * @desc    Create a new user in database
   * @param   {Object} userData - User data (email, password, name, role)
   * @returns {Promise<Object>} Created user object
   */
  async createUser(userData) {
    try {
      const user = new this.UserModel(userData);
      await user.save();
      return user.toObject();
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * @desc    Find user by email address
   * @param   {string} email - User's email address
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findUserByEmail(email) {
    try {
      const user = await this.UserModel.findOne({ email: email.toLowerCase() });
      return user ? user.toObject() : null;
    } catch (error) {
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  /**
   * @desc    Find user by MongoDB ObjectId
   * @param   {string} id - User's MongoDB ObjectId
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findUserById(id) {
    try {
      const user = await this.UserModel.findById(id);
      return user ? user.toObject() : null;
    } catch (error) {
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  /**
   * @desc    Get all users from database
   * @returns {Promise<Array>} Array of user objects
   */
  async getAllUsers() {
    try {
      const users = await this.UserModel.find({});
      return users.map(user => user.toObject());
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
  }

  /**
   * @desc    Update user by ID
   * @param   {string} id - User's MongoDB ObjectId
   * @param   {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated user object or null
   */
  async updateUser(id, updates) {
    try {
      const user = await this.UserModel.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );
      return user ? user.toObject() : null;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * Delete user
   * @param {string} id - User ID
   * @returns {Promise<boolean>} - True if deleted
   */
  async deleteUser(id) {
    try {
      const result = await this.UserModel.findByIdAndDelete(id);
      return result !== null;
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}

// Export
module.exports = {
  connectDB,
  disconnectDB,
  db: new Database()
};
