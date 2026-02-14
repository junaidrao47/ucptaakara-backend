/**
 * =============================================================================
 * TOKEN GENERATOR UTILITY
 * =============================================================================
 * JWT token generation and verification with refresh token support
 * 
 * Features:
 * - Access token: Short-lived (15min) for API requests
 * - Refresh token: Long-lived (7d) for getting new access tokens
 * - Secure token verification
 * =============================================================================
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRE } = require('../config/jwt');

// Token expiration times
const ACCESS_TOKEN_EXPIRE = '15m';   // 15 minutes
const REFRESH_TOKEN_EXPIRE = '7d';   // 7 days

/**
 * @desc    Generate access token (short-lived)
 * @param   {Object} payload - Data to encode { id, email, role }
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    { ...payload, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRE }
  );
};

/**
 * @desc    Generate refresh token (long-lived)
 * @param   {Object} payload - Data to encode { id }
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    { id: payload.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRE }
  );
};

/**
 * @desc    Generate both access and refresh tokens
 * @param   {Object} payload - User data { id, email, role }
 * @returns {Object} { accessToken, refreshToken }
 */
const generateTokenPair = (payload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
};

/**
 * @desc    Legacy function for backward compatibility
 * @param   {Object} payload - Data to encode
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE || '7d' });
};

/**
 * @desc    Verify JWT token
 * @param   {string} token - JWT token
 * @returns {Object|null} Decoded token or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * @desc    Verify refresh token specifically
 * @param   {string} token - Refresh token
 * @returns {Object|null} Decoded token or null if invalid/not refresh type
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * @desc    Decode token without verification (for debugging)
 * @param   {string} token - JWT token
 * @returns {Object|null} Decoded token
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * @desc    Get token expiration time in seconds
 * @param   {string} token - JWT token
 * @returns {number|null} Seconds until expiration
 */
const getTokenExpiry = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return null;
    return decoded.exp - Math.floor(Date.now() / 1000);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  verifyRefreshToken,
  decodeToken,
  getTokenExpiry,
  ACCESS_TOKEN_EXPIRE,
  REFRESH_TOKEN_EXPIRE
};
