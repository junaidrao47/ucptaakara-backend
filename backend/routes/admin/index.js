/**
 * =============================================================================
 * ADMIN ROUTES INDEX
 * =============================================================================
 * Aggregates all admin routes
 * Base path: /api/admin
 * 
 * All routes require admin authentication
 * =============================================================================
 */

const express = require('express');
const router = express.Router();

// Import route modules
const categoryRoutes = require('./categoryRoutes');
const competitionRoutes = require('./competitionRoutes');
const registrationRoutes = require('./registrationRoutes');
const analyticsRoutes = require('./analyticsRoutes');

// Import middleware
const authenticate = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleCheck');

// Apply authentication to all admin routes
router.use(authenticate);
router.use(requireRole(['admin']));

// Mount routes
router.use('/categories', categoryRoutes);
router.use('/competitions', competitionRoutes);
router.use('/registrations', registrationRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
