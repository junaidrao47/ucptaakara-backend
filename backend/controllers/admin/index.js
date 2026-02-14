/**
 * =============================================================================
 * ADMIN CONTROLLERS INDEX
 * =============================================================================
 * Exports all admin controllers for easy importing
 * =============================================================================
 */

const categoryController = require('./categoryController');
const competitionController = require('./competitionController');
const registrationController = require('./registrationController');
const analyticsController = require('./analyticsController');

module.exports = {
  category: categoryController,
  competition: competitionController,
  registration: registrationController,
  analytics: analyticsController
};
