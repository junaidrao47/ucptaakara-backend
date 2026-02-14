/**
 * =============================================================================
 * PASSPORT.JS CONFIGURATION
 * =============================================================================
 * Google OAuth 2.0 authentication strategy using Passport.js
 * 
 * Features:
 * - Google OAuth 2.0 login
 * - Automatic user creation/linking
 * - JWT token generation after OAuth
 * 
 * Environment Variables Required:
 *   GOOGLE_CLIENT_ID     - Google OAuth Client ID
 *   GOOGLE_CLIENT_SECRET - Google OAuth Client Secret
 *   GOOGLE_CALLBACK_URL  - OAuth callback URL
 * 
 * Setup Instructions:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing
 * 3. Enable Google+ API
 * 4. Go to Credentials > Create OAuth 2.0 Client ID
 * 5. Add authorized redirect URI: http://localhost:5000/api/auth/google/callback
 * 6. Copy Client ID and Secret to .env file
 * =============================================================================
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/UserSchema');

/**
 * Serialize user for session (stores user ID in session)
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session (retrieves user from database)
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

/**
 * Google OAuth 2.0 Strategy Configuration
 */
const configureGoogleStrategy = () => {
  // Check if Google OAuth credentials are configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('⚠ Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Find or create user from Google profile
          const user = await User.findOrCreateGoogleUser(profile);
          return done(null, user);
        } catch (error) {
          console.error('Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );

  console.log('✓ Google OAuth strategy configured');
};

/**
 * Initialize Passport with all strategies
 */
const initializePassport = (app) => {
  // Initialize Passport
  app.use(passport.initialize());
  
  // Configure Google Strategy
  configureGoogleStrategy();
  
  console.log('✓ Passport initialized');
};

module.exports = {
  passport,
  initializePassport,
  configureGoogleStrategy
};
