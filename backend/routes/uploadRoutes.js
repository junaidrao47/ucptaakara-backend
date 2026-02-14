/**
 * =============================================================================
 * UPLOAD ROUTES
 * =============================================================================
 * Routes for file uploads (images)
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  uploadCategoryImages,
  uploadCompetitionImages,
  uploadSingleImage,
  handleUploadError
} = require('../middleware/upload');
const {
  uploadCategoryImage,
  uploadCompetitionImage,
  deleteGalleryImage,
  uploadGenericImage
} = require('../controllers/uploadController');

// =============================================================================
// ADMIN UPLOAD ROUTES
// =============================================================================

/**
 * @route   POST /api/uploads/category/:id
 * @desc    Upload category images (icon, banner)
 * @access  Admin
 */
router.post(
  '/category/:id',
  authenticate,
  authorize('admin'),
  uploadCategoryImages,
  handleUploadError,
  uploadCategoryImage
);

/**
 * @route   POST /api/uploads/competition/:id
 * @desc    Upload competition images (cover, gallery)
 * @access  Admin
 */
router.post(
  '/competition/:id',
  authenticate,
  authorize('admin'),
  uploadCompetitionImages,
  handleUploadError,
  uploadCompetitionImage
);

/**
 * @route   DELETE /api/uploads/competition/:id/gallery/:imageIndex
 * @desc    Delete a gallery image from competition
 * @access  Admin
 */
router.delete(
  '/competition/:id/gallery/:imageIndex',
  authenticate,
  authorize('admin'),
  deleteGalleryImage
);

// =============================================================================
// GENERIC UPLOAD ROUTES
// =============================================================================

/**
 * @route   POST /api/uploads/image
 * @desc    Upload a single image (generic)
 * @access  Authenticated
 */
router.post(
  '/image',
  authenticate,
  uploadSingleImage('image'),
  handleUploadError,
  uploadGenericImage
);

module.exports = router;
