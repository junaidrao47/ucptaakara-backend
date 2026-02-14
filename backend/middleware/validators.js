/**
 * =============================================================================
 * VALIDATION MIDDLEWARE
 * =============================================================================
 * Express-validator based validation for all API endpoints
 * 
 * Features:
 * - Input sanitization
 * - Type checking
 * - Custom validators
 * - Error formatting
 * =============================================================================
 */

const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// =============================================================================
// VALIDATION RESULT HANDLER
// =============================================================================

/**
 * Middleware to check validation results and return errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
  }
  
  next();
};

// =============================================================================
// CUSTOM VALIDATORS
// =============================================================================

/**
 * Check if value is a valid MongoDB ObjectId
 */
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid ID format');
  }
  return true;
};

/**
 * Check if date is in the future
 */
const isFutureDate = (value) => {
  const date = new Date(value);
  if (date <= new Date()) {
    throw new Error('Date must be in the future');
  }
  return true;
};

/**
 * Check if value is a valid URL
 */
const isValidUrl = (value) => {
  if (!value) return true; // Optional field
  try {
    new URL(value);
    return true;
  } catch {
    throw new Error('Invalid URL format');
  }
};

// =============================================================================
// CATEGORY VALIDATIONS
// =============================================================================

const categoryValidation = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Category name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('icon')
      .optional()
      .trim()
      .custom(isValidUrl),
    body('color')
      .optional()
      .trim()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$|^[a-zA-Z]+$/)
      .withMessage('Invalid color format'),
    body('displayOrder')
      .optional()
      .isInt({ min: 0 }).withMessage('Display order must be a positive integer'),
    validate
  ],

  update: [
    param('id').custom(isValidObjectId),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('icon')
      .optional()
      .trim()
      .custom(isValidUrl),
    body('color')
      .optional()
      .trim()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$|^[a-zA-Z]+$/)
      .withMessage('Invalid color format'),
    body('displayOrder')
      .optional()
      .isInt({ min: 0 }).withMessage('Display order must be a positive integer'),
    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be a boolean'),
    validate
  ],

  paramId: [
    param('id').custom(isValidObjectId),
    validate
  ]
};

// =============================================================================
// COMPETITION VALIDATIONS
// =============================================================================

const competitionValidation = {
  create: [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required')
      .isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
    body('shortDescription')
      .optional()
      .trim()
      .isLength({ max: 300 }).withMessage('Short description cannot exceed 300 characters'),
    body('category')
      .notEmpty().withMessage('Category is required')
      .custom(isValidObjectId),
    body('deadline')
      .notEmpty().withMessage('Deadline is required')
      .isISO8601().withMessage('Invalid date format')
      .custom(isFutureDate),
    body('startDate')
      .optional()
      .isISO8601().withMessage('Invalid start date format'),
    body('endDate')
      .optional()
      .isISO8601().withMessage('Invalid end date format'),
    body('maxRegistrations')
      .optional()
      .isInt({ min: 0 }).withMessage('Max registrations must be a positive integer'),
    body('venue')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Venue cannot exceed 200 characters'),
    body('isOnline')
      .optional()
      .isBoolean().withMessage('isOnline must be a boolean'),
    body('type')
      .optional()
      .isIn(['individual', 'team']).withMessage('Type must be individual or team'),
    body('teamSize.min')
      .optional()
      .isInt({ min: 1 }).withMessage('Minimum team size must be at least 1'),
    body('teamSize.max')
      .optional()
      .isInt({ min: 1 }).withMessage('Maximum team size must be at least 1'),
    body('prizes')
      .optional()
      .isArray().withMessage('Prizes must be an array'),
    body('prizes.*.position')
      .optional()
      .isInt({ min: 1 }).withMessage('Prize position must be a positive integer'),
    body('prizes.*.title')
      .optional()
      .trim()
      .notEmpty().withMessage('Prize title is required'),
    body('prizes.*.amount')
      .optional()
      .isFloat({ min: 0 }).withMessage('Prize amount must be positive'),
    body('requirements')
      .optional()
      .isArray().withMessage('Requirements must be an array'),
    body('rules')
      .optional()
      .isArray().withMessage('Rules must be an array'),
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array'),
    body('banner')
      .optional()
      .trim()
      .custom(isValidUrl),
    body('thumbnail')
      .optional()
      .trim()
      .custom(isValidUrl),
    body('externalLink')
      .optional()
      .trim()
      .custom(isValidUrl),
    body('contactEmail')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid contact email'),
    body('isFeatured')
      .optional()
      .isBoolean().withMessage('isFeatured must be a boolean'),
    validate
  ],

  update: [
    param('id').custom(isValidObjectId),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
    body('shortDescription')
      .optional()
      .trim()
      .isLength({ max: 300 }).withMessage('Short description cannot exceed 300 characters'),
    body('category')
      .optional()
      .custom(isValidObjectId),
    body('deadline')
      .optional()
      .isISO8601().withMessage('Invalid date format'),
    body('startDate')
      .optional()
      .isISO8601().withMessage('Invalid start date format'),
    body('endDate')
      .optional()
      .isISO8601().withMessage('Invalid end date format'),
    body('maxRegistrations')
      .optional()
      .isInt({ min: 0 }).withMessage('Max registrations must be a positive integer'),
    body('status')
      .optional()
      .isIn(['draft', 'published', 'cancelled', 'completed'])
      .withMessage('Invalid status'),
    body('isFeatured')
      .optional()
      .isBoolean().withMessage('isFeatured must be a boolean'),
    validate
  ],

  query: [
    query('category')
      .optional()
      .custom(isValidObjectId),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Search query too long'),
    query('sort')
      .optional()
      .isIn(['most', 'trending', 'new', 'deadline', 'prize', 'views'])
      .withMessage('Invalid sort option'),
    query('startDate')
      .optional()
      .isISO8601().withMessage('Invalid start date format'),
    query('endDate')
      .optional()
      .isISO8601().withMessage('Invalid end date format'),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('type')
      .optional()
      .isIn(['individual', 'team']).withMessage('Invalid type'),
    query('isOnline')
      .optional()
      .isBoolean().withMessage('isOnline must be true or false'),
    query('featured')
      .optional()
      .isBoolean().withMessage('featured must be true or false'),
    query('active')
      .optional()
      .isBoolean().withMessage('active must be true or false'),
    validate
  ],

  calendar: [
    query('month')
      .notEmpty().withMessage('Month is required')
      .isInt({ min: 1, max: 12 }).withMessage('Month must be 1-12'),
    query('year')
      .notEmpty().withMessage('Year is required')
      .isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    validate
  ],

  paramId: [
    param('id').custom(isValidObjectId),
    validate
  ]
};

// =============================================================================
// REGISTRATION VALIDATIONS
// =============================================================================

const registrationValidation = {
  create: [
    param('competitionId').custom(isValidObjectId),
    body('teamName')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Team name cannot exceed 100 characters'),
    body('teamMembers')
      .optional()
      .isArray().withMessage('Team members must be an array'),
    body('teamMembers.*.name')
      .optional()
      .trim()
      .notEmpty().withMessage('Team member name is required'),
    body('teamMembers.*.email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid team member email'),
    body('phone')
      .optional()
      .trim()
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/)
      .withMessage('Invalid phone number'),
    body('institution')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Institution name cannot exceed 200 characters'),
    body('additionalInfo')
      .optional()
      .isObject().withMessage('Additional info must be an object'),
    validate
  ],

  approve: [
    param('id').custom(isValidObjectId),
    validate
  ],

  reject: [
    param('id').custom(isValidObjectId),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
    validate
  ],

  query: [
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'cancelled', 'completed'])
      .withMessage('Invalid status'),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Search query too long'),
    validate
  ],

  submission: [
    param('id').custom(isValidObjectId),
    body('link')
      .notEmpty().withMessage('Submission link is required')
      .trim()
      .custom(isValidUrl),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    validate
  ],

  paramId: [
    param('id').custom(isValidObjectId),
    validate
  ]
};

// =============================================================================
// PAGINATION HELPER
// =============================================================================

/**
 * Extract and validate pagination params from query
 * @param {Object} query - Request query object
 * @param {Object} defaults - Default values
 * @returns {Object} { page, limit, skip }
 */
const getPagination = (query, defaults = { page: 1, limit: 10 }) => {
  const page = Math.max(1, parseInt(query.page) || defaults.page);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defaults.limit));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

/**
 * Format pagination response
 * @param {number} total - Total documents
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object}
 */
const formatPagination = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1
});

module.exports = {
  validate,
  isValidObjectId,
  categoryValidation,
  competitionValidation,
  registrationValidation,
  getPagination,
  formatPagination
};
