/**
 * =============================================================================
 * ROUTES INDEX
 * =============================================================================
 * Central route configuration that combines all route modules
 * 
 * Structure:
 * /api/auth/*   - Authentication routes (login, register, logout)
 * /api/users/*  - User management routes
 * /api/health   - Health check endpoint
 * =============================================================================
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * Authentication Routes
 * @path /api/auth/*
 */
router.use('/auth', authRoutes);

/**
 * User Management Routes
 * @path /api/users/*
 */
router.use('/users', userRoutes);

/**
 * Health Check Endpoint
 * @route GET /api/health
 * @desc  Check if API is running
 * @access Public
 */
router.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * API Welcome Endpoint
 * @route GET /api
 * @desc  API welcome message
 * @access Public
 */
router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Welcome to UCP-TAKRA API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      health: '/api/health'
    }
  });
});

module.exports = router;
