/**
 * =============================================================================
 * UPLOAD MIDDLEWARE
 * =============================================================================
 * Multer configuration for handling file uploads
 * =============================================================================
 */

const multer = require('multer');
const path = require('path');

// Allowed MIME types
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  video: ['video/mp4', 'video/webm', 'video/quicktime']
};

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,      // 10MB
  document: 25 * 1024 * 1024,   // 25MB
  video: 100 * 1024 * 1024      // 100MB
};

// Memory storage (for processing before S3 upload)
const memoryStorage = multer.memoryStorage();

/**
 * File filter factory
 * @param {string[]} allowedTypes - Array of allowed MIME types
 * @returns {Function} Multer file filter function
 */
const createFileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

/**
 * Create multer upload instance
 * @param {Object} options - Upload options
 * @returns {multer.Multer} Multer instance
 */
const createUploader = (options = {}) => {
  const {
    fileTypes = 'image',
    maxSize = null,
    maxFiles = 10
  } = options;

  const allowedTypes = Array.isArray(fileTypes) 
    ? fileTypes 
    : ALLOWED_MIME_TYPES[fileTypes] || ALLOWED_MIME_TYPES.image;
  
  const sizeLimit = maxSize || FILE_SIZE_LIMITS[fileTypes] || FILE_SIZE_LIMITS.image;

  return multer({
    storage: memoryStorage,
    limits: {
      fileSize: sizeLimit,
      files: maxFiles
    },
    fileFilter: createFileFilter(allowedTypes)
  });
};

// Pre-configured uploaders
const imageUploader = createUploader({ fileTypes: 'image', maxFiles: 10 });
const singleImageUploader = createUploader({ fileTypes: 'image', maxFiles: 1 });
const documentUploader = createUploader({ fileTypes: 'document', maxFiles: 5 });

/**
 * Single image upload middleware
 * @param {string} fieldName - Form field name
 */
const uploadSingleImage = (fieldName = 'image') => singleImageUploader.single(fieldName);

/**
 * Multiple images upload middleware
 * @param {string} fieldName - Form field name
 * @param {number} maxCount - Maximum number of files
 */
const uploadMultipleImages = (fieldName = 'images', maxCount = 10) => 
  imageUploader.array(fieldName, maxCount);

/**
 * Multiple fields upload middleware
 * @param {Array} fields - Array of { name, maxCount }
 */
const uploadFields = (fields) => imageUploader.fields(fields);

/**
 * Category image upload middleware
 * Accepts: icon and banner
 */
const uploadCategoryImages = imageUploader.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]);

/**
 * Competition image upload middleware
 * Accepts: cover and gallery (multiple)
 */
const uploadCompetitionImages = imageUploader.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]);

/**
 * Error handler middleware for multer errors
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large',
          error: `Maximum file size exceeded`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files',
          error: `Maximum number of files exceeded`
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected field',
          error: `Unexpected file field: ${err.field}`
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'Upload error',
          error: err.message
        });
    }
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: 'Upload failed',
      error: err.message
    });
  }
  
  next();
};

module.exports = {
  createUploader,
  uploadSingleImage,
  uploadMultipleImages,
  uploadFields,
  uploadCategoryImages,
  uploadCompetitionImages,
  handleUploadError,
  ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS
};
