/**
 * =============================================================================
 * ROUTES INDEX
 * =============================================================================
 * Central route configuration that combines all route modules
 * 
 * Structure:
 * /api/auth/*          - Authentication routes (login, register, logout)
 * /api/users/*         - User management routes
 * /api/dashboard/*     - User dashboard routes
 * /api/categories/*    - Public category browsing
 * /api/competitions/*  - Public competition browsing
 * /api/registrations/* - User registration management
 * /api/uploads/*       - File upload routes
 * /api/support/*       - Support staff routes
 * /api/admin/*         - Admin management routes
 * /api/health          - Health check endpoint
 * =============================================================================
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const categoryRoutes = require('./categoryRoutes');
const competitionRoutes = require('./competitionRoutes');
const registrationRoutes = require('./registrationRoutes');
const uploadRoutes = require('./uploadRoutes');
const supportRoutes = require('./supportRoutes');
const chatRoutes = require('./chatRoutes');
const adminRoutes = require('./admin');

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
 * User Dashboard Routes
 * @path /api/dashboard/*
 */
router.use('/dashboard', dashboardRoutes);

/**
 * Category Routes (Public)
 * @path /api/categories/*
 */
router.use('/categories', categoryRoutes);

/**
 * Competition Routes (Public)
 * @path /api/competitions/*
 */
router.use('/competitions', competitionRoutes);

/**
 * Registration Routes (Authenticated)
 * @path /api/registrations/*
 */
router.use('/registrations', registrationRoutes);

/**
 * Upload Routes (Authenticated)
 * @path /api/uploads/*
 */
router.use('/uploads', uploadRoutes);

/**
 * Chat Routes (Authenticated)
 * @path /api/chat/*
 */
router.use('/chat', chatRoutes);

/**
 * Support Routes (Support role)
 * @path /api/support/*
 */
router.use('/support', supportRoutes);

/**
 * Admin Routes (Admin only)
 * @path /api/admin/*
 */
router.use('/admin', adminRoutes);

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
    message: 'Welcome to UCP-TAKRA Competition Management API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      dashboard: '/api/dashboard',
      categories: '/api/categories',
      competitions: '/api/competitions',
      registrations: '/api/registrations',
      uploads: '/api/uploads',
      chat: '/api/chat',
      support: '/api/support',
      admin: '/api/admin',
      health: '/api/health'
    }
  });
});

module.exports = router;
