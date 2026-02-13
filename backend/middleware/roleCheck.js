/**
 * =============================================================================
 * ROLE-BASED AUTHORIZATION MIDDLEWARE
 * =============================================================================
 * Checks if authenticated user has required role(s) for accessing a resource
 * 
 * Usage:
 *   router.get('/admin', authenticate, authorize('admin'), controller.method);
 *   router.get('/staff', authenticate, authorize('admin', 'moderator'), controller.method);
 * 
 * Available Roles:
 *   - user      : Regular user (default)
 *   - moderator : Moderator with elevated permissions
 *   - admin     : Administrator with full access
 * 
 * Prerequisites:
 *   - Must be used after authenticate middleware
 *   - req.user must contain role property
 * =============================================================================
 */

/**
 * @desc    Authorize user based on role(s)
 * @param   {...string} allowedRoles - One or more roles allowed to access
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Single role
 * router.get('/admin-only', authenticate, authorize('admin'), handler);
 * 
 * // Multiple roles
 * router.get('/staff-only', authenticate, authorize('admin', 'moderator'), handler);
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Verify user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Authentication required.'
        });
      }

      // Check if user's role is in allowed roles
      const userRole = req.user.role?.toLowerCase();
      const normalizedRoles = allowedRoles.map(role => role.toLowerCase());

      if (!normalizedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`
        });
      }

      // User is authorized, proceed to next middleware
      next();

    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

module.exports = authorize;
