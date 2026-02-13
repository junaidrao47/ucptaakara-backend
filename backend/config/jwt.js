require('dotenv').config();

/**
 * JWT Configuration
 * Token generation and verification settings
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

module.exports = {
  JWT_SECRET,
  JWT_EXPIRE
};
