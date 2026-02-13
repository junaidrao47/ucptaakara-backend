/**
 * =============================================================================
 * CACHE MIDDLEWARE
 * =============================================================================
 * Redis-based caching middleware for GET request responses
 * 
 * Features:
 * - Auto-caches successful GET responses
 * - User-specific cache keys (isolated per user)
 * - Configurable TTL (time-to-live)
 * - Graceful fallback when Redis is unavailable
 * - Cache invalidation utilities
 * 
 * Usage:
 *   router.get('/data', authenticate, cacheMiddleware(600), controller.method);
 * 
 * Cache Key Format:
 *   cache:<userId>:<route>
 *   Example: cache:507f1f77bcf86cd799439011:/api/users/me
 * =============================================================================
 */

const cacheService = require('../config/cache');

/**
 * @desc    Generate cache key from request
 * @param   {Object} req - Express request object
 * @returns {string} Cache key string
 */
const generateCacheKey = (req) => {
  const userId = req.user?.id || 'anonymous';
  const route = req.originalUrl || req.url;
  return `cache:${userId}:${route}`;
};

/**
 * @desc    Cache middleware for GET requests
 * @param   {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Cache for 10 minutes
 * router.get('/profile', authenticate, cacheMiddleware(600), getProfile);
 * 
 * // Cache for 5 minutes (default)
 * router.get('/data', authenticate, cacheMiddleware(), getData);
 */
const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const cacheKey = generateCacheKey(req);

      // Try to retrieve from cache
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        // Cache hit - return cached response
        return res.status(200).json(cachedData);
      }

      // Cache miss - override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function (data) {
        // Only cache successful responses (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, ttl).catch(err => {
            console.error('Cache set error:', err.message);
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      // On cache error, continue without caching
      console.error('Cache middleware error:', error.message);
      next();
    }
  };
};

/**
 * @desc    Invalidate cache keys matching a pattern
 * @param   {string} pattern - Redis key pattern (supports * wildcard)
 * @returns {Promise<void>}
 * 
 * @example
 * await invalidateCachePattern('cache:userId123:*');
 */
const invalidateCachePattern = async (pattern) => {
  try {
    const client = cacheService.getClient();
    if (!client || !client.isOpen) return;

    const keys = [];
    let cursor = '0';

    // Use SCAN to find all matching keys (Redis best practice)
    do {
      const reply = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });

      cursor = reply.cursor;
      keys.push(...reply.keys);
    } while (cursor !== '0');

    // Delete all found keys
    if (keys.length > 0) {
      await cacheService.delMany(keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error.message);
  }
};

/**
 * @desc    Clear all cache for a specific user
 * @param   {string} userId - User's ID
 * @returns {Promise<void>}
 * 
 * @example
 * await clearUserCache('507f1f77bcf86cd799439011');
 */
const clearUserCache = async (userId) => {
  if (!userId) return;
  const pattern = `cache:${userId}:*`;
  await invalidateCachePattern(pattern);
};

/**
 * @desc    Clear all cache for a specific route
 * @param   {string} route - Route path
 * @returns {Promise<void>}
 * 
 * @example
 * await clearRouteCache('/api/users');
 */
const clearRouteCache = async (route) => {
  if (!route) return;
  const pattern = `cache:*:${route}*`;
  await invalidateCachePattern(pattern);
};

module.exports = {
  cacheMiddleware,
  generateCacheKey,
  invalidateCachePattern,
  clearUserCache,
  clearRouteCache
};
