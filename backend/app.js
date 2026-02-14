/**
 * =============================================================================
 * EXPRESS APPLICATION CONFIGURATION
 * =============================================================================
 * Main Express application setup with middleware and route configuration
 * 
 * Features:
 * - JSON body parsing
 * - URL-encoded body parsing
 * - Static file serving
 * - Passport.js authentication (Google OAuth)
 * - API routes
 * - Error handling
 * - 404 handling
 * =============================================================================
 */

require('dotenv').config();
const express = require('express');
const app = express();

// Import Passport configuration
const { initializePassport } = require('./config/passport');

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

/**
 * Body Parser Middleware
 * - Parses incoming JSON requests
 * - Parses URL-encoded data
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Static Files Middleware
 * - Serves static files from 'public' directory
 */
app.use(express.static('public'));

/**
 * CORS Configuration
 * - Allows requests from approved frontend origins
 */
const allowedOrigins = [
  'https://takra-admin.vercel.app',
  'https://takra-frontend.vercel.app',
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:5173'  // Vite dev server
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

/**
 * Passport.js Initialization
 * - Configures Google OAuth 2.0 strategy
 */
initializePassport(app);

/**
 * Request Logger (Development only)
 */
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
  });
}

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * Main API Routes
 * All API routes are prefixed with /api
 */
const routes = require('./routes/index');
app.use('/api', routes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * 404 Not Found Handler
 * Catches all requests that don't match any route
 */
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

/**
 * Global Error Handler
 * Catches all errors thrown in the application
 */
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err.stack);
  
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;
