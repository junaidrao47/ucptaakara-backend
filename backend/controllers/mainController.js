/**
 * Main Controller
 * Example controller showing best practices
 */

const db = require('../config/database');

/**
 * Get dashboard stats (Admin only)
 */
const getDashboardStats = (req, res) => {
  try {
    const users = db.getAllUsers();
    
    const stats = {
      totalUsers: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      moderators: users.filter(u => u.role === 'moderator').length,
      users: users.filter(u => u.role === 'user').length
    };

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats
};
