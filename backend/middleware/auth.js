/**
 * =============================================================================
 * AUTHENTICATION MIDDLEWARE
 * =============================================================================
 * Verifies JWT token and attaches user data to request object
 * 
 * Usage:
 *   router.get('/protected', authenticate, controller.method);
 * 
 * Request Headers Required:
 *   Authorization: Bearer <jwt_token>
 * 
 * After Authentication:
 *   req.user = { id, email, role, iat, exp }
 * =============================================================================
 */

const { verifyToken } = require('../utils/tokenGenerator');
const cacheService = require('../config/cache');

/**
 * @desc    Authenticate user using JWT token
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @param   {Function} next - Express next middleware function
 * @returns {void}
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Extract token (Bearer <token>)
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format. Use: Bearer <token>'
      });
    }

    // Check if token is blacklisted (logged out)
    if (cacheService.isConnected()) {
      const isBlacklisted = await cacheService.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: 'Token has been invalidated. Please login again.'
        });
      }
    }

    // Verify token signature and expiration
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Attach user data to request object
    req.user = decoded;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = authenticate;
