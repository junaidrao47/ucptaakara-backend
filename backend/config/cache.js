/**
 * =============================================================================
 * REDIS CACHE CONFIGURATION
 * =============================================================================
 * Redis connection management and caching operations
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - JSON serialization/deserialization
 * - TTL (time-to-live) support
 * - Graceful fallback when Redis is unavailable
 * 
 * Environment Variables:
 *   REDIS_URL - Redis connection string
 *               Default: redis://:redis123@localhost:6379
 *               Docker:  redis://:redis123@redis:6379
 * 
 * Usage:
 *   const cache = require('./config/cache');
 *   await cache.initializeCache();
 *   await cache.set('key', { data: 'value' }, 3600);
 *   const data = await cache.get('key');
 * =============================================================================
 */

const redis = require('redis');
require('dotenv').config();

const REDIS_URL = process.env.REDIS_URL || 'redis://:redis123@localhost:6379';

// Redis client instance
let client;

/**
 * @desc    Initialize Redis connection
 * @returns {Promise<void>}
 */
const initializeCache = async () => {
  try {
    client = redis.createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          const delay = Math.min(retries * 50, 500);
          return delay;
        }
      }
    });

    // Event handlers
    client.on('error', (err) => console.error('✗ Redis Error:', err));
    client.on('connect', () => console.log('✓ Redis connected'));
    client.on('reconnecting', () => console.log('↻ Redis reconnecting...'));

    // Connect to Redis
    await client.connect();
    console.log('✓ Redis cache initialized successfully');
  } catch (error) {
    console.error('✗ Redis connection failed:', error.message);
    console.log('⚠ Running without caching');
    return null;
  }
};

/**
 * @desc    Get value from cache
 * @param   {string} key - Cache key
 * @returns {Promise<any>} Cached value or null
 */
const get = async (key) => {
  try {
    if (!client || !client.isOpen) return null;
    
    const value = await client.get(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  } catch (error) {
    console.error('Cache get error:', error.message);
    return null;
  }
};

/**
 * @desc    Set value in cache
 * @param   {string} key - Cache key
 * @param   {any} value - Value to cache (auto-serialized)
 * @param   {number} ttl - Time to live in seconds (default: 3600)
 * @returns {Promise<boolean>} Success status
 */
const set = async (key, value, ttl = 3600) => {
  try {
    if (!client || !client.isOpen) return false;

    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl) {
      await client.setEx(key, ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error.message);
    return false;
  }
};

/**
 * @desc    Delete single key from cache
 * @param   {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
const del = async (key) => {
  try {
    if (!client || !client.isOpen) return false;
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error.message);
    return false;
  }
};

/**
 * @desc    Delete multiple keys from cache
 * @param   {Array<string>} keys - Array of cache keys
 * @returns {Promise<boolean>} Success status
 */
const delMany = async (keys) => {
  try {
    if (!client || !client.isOpen) return false;
    if (keys.length === 0) return true;
    await client.del(keys);
    return true;
  } catch (error) {
    console.error('Cache deleteMany error:', error.message);
    return false;
  }
};

/**
 * Clear all cache
 * @returns {Promise<boolean>} - Success status
 */
const flush = async () => {
  try {
    if (!client || !client.isOpen) return false;
    await client.flushDb();
    return true;
  } catch (error) {
    console.error('Cache flush error:', error.message);
    return false;
  }
};

/**
 * Check if cache is connected
 * @returns {boolean} - Connection status
 */
const isConnected = () => {
  return client && client.isOpen;
};

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
  try {
    if (client && client.isOpen) {
      await client.quit();
      console.log('✓ Redis connection closed');
    }
  } catch (error) {
    console.error('Error closing Redis connection:', error.message);
  }
};

/**
 * Get Redis client instance
 * @returns {object} - Redis client
 */
const getClient = () => client;

module.exports = {
  initializeCache,
  get,
  set,
  del,
  delete: del,       // Alias so controllers can use cacheService.delete()
  delMany,
  flush,
  isConnected,
  closeConnection,
  getClient
};
