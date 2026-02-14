/**
 * =============================================================================
 * IMAGE OPTIMIZATION UTILITY
 * =============================================================================
 * Uses Sharp for image processing and optimization
 * =============================================================================
 */

const sharp = require('sharp');

// Default image sizes
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 300, height: 300 },
  medium: { width: 600, height: 600 },
  large: { width: 1200, height: 1200 },
  banner: { width: 1920, height: 600 },
  card: { width: 400, height: 250 }
};

// Compression quality settings
const QUALITY = {
  high: 90,
  medium: 80,
  low: 60
};

/**
 * Optimize a single image
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Optimization options
 * @returns {Promise<Buffer>} Optimized image buffer
 */
const optimizeImage = async (buffer, options = {}) => {
  const {
    width = null,
    height = null,
    quality = QUALITY.medium,
    format = 'webp',
    fit = 'cover',
    background = { r: 255, g: 255, b: 255, alpha: 1 }
  } = options;

  let pipeline = sharp(buffer);

  // Resize if dimensions provided
  if (width || height) {
    pipeline = pipeline.resize({
      width,
      height,
      fit,
      background,
      withoutEnlargement: true
    });
  }

  // Convert to specified format
  switch (format) {
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'jpeg':
    case 'jpg':
      pipeline = pipeline.jpeg({ quality, progressive: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9 - Math.floor(quality / 11) });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality });
      break;
    default:
      pipeline = pipeline.webp({ quality });
  }

  return pipeline.toBuffer();
};

/**
 * Generate multiple sizes of an image
 * @param {Buffer} buffer - Original image buffer
 * @param {string[]} sizes - Array of size names (thumbnail, small, medium, large)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Object with sized buffers
 */
const generateImageSizes = async (buffer, sizes = ['thumbnail', 'medium'], options = {}) => {
  const { format = 'webp', quality = QUALITY.medium } = options;
  const results = {};

  // Always include original (optimized)
  results.original = await optimizeImage(buffer, { format, quality: QUALITY.high });

  // Generate requested sizes
  for (const size of sizes) {
    const dimensions = IMAGE_SIZES[size];
    if (dimensions) {
      results[size] = await optimizeImage(buffer, {
        ...dimensions,
        format,
        quality
      });
    }
  }

  return results;
};

/**
 * Get image metadata
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} Image metadata
 */
const getImageMetadata = async (buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      hasAlpha: metadata.hasAlpha
    };
  } catch (error) {
    console.error('Error getting image metadata:', error);
    return null;
  }
};

/**
 * Validate image dimensions
 * @param {Buffer} buffer - Image buffer
 * @param {Object} constraints - Min/max width/height
 * @returns {Promise<Object>} Validation result
 */
const validateImageDimensions = async (buffer, constraints = {}) => {
  const {
    minWidth = 100,
    minHeight = 100,
    maxWidth = 5000,
    maxHeight = 5000
  } = constraints;

  const metadata = await getImageMetadata(buffer);
  if (!metadata) {
    return { valid: false, error: 'Could not read image metadata' };
  }

  if (metadata.width < minWidth || metadata.height < minHeight) {
    return {
      valid: false,
      error: `Image too small. Minimum size: ${minWidth}x${minHeight}px`
    };
  }

  if (metadata.width > maxWidth || metadata.height > maxHeight) {
    return {
      valid: false,
      error: `Image too large. Maximum size: ${maxWidth}x${maxHeight}px`
    };
  }

  return { valid: true, metadata };
};

/**
 * Create a placeholder/blurred image (for lazy loading)
 * @param {Buffer} buffer - Original image buffer
 * @returns {Promise<string>} Base64 encoded blurred placeholder
 */
const createPlaceholder = async (buffer) => {
  const placeholderBuffer = await sharp(buffer)
    .resize(20, 20, { fit: 'inside' })
    .blur(5)
    .webp({ quality: 20 })
    .toBuffer();

  return `data:image/webp;base64,${placeholderBuffer.toString('base64')}`;
};

/**
 * Process category image (icon/banner)
 * @param {Buffer} buffer - Image buffer
 * @param {string} type - 'icon' or 'banner'
 * @returns {Promise<Object>} Processed images
 */
const processCategoryImage = async (buffer, type = 'icon') => {
  const format = 'webp';
  const results = {};

  if (type === 'icon') {
    results.original = await optimizeImage(buffer, { 
      width: 200, 
      height: 200, 
      format, 
      quality: QUALITY.high 
    });
    results.thumbnail = await optimizeImage(buffer, { 
      width: 64, 
      height: 64, 
      format, 
      quality: QUALITY.medium 
    });
  } else if (type === 'banner') {
    results.original = await optimizeImage(buffer, { 
      width: 1200, 
      height: 400, 
      format, 
      quality: QUALITY.high 
    });
    results.thumbnail = await optimizeImage(buffer, { 
      width: 400, 
      height: 133, 
      format, 
      quality: QUALITY.medium 
    });
  }

  results.placeholder = await createPlaceholder(buffer);
  return results;
};

/**
 * Process competition images (cover, gallery)
 * @param {Buffer} buffer - Image buffer
 * @param {string} type - 'cover' or 'gallery'
 * @returns {Promise<Object>} Processed images
 */
const processCompetitionImage = async (buffer, type = 'cover') => {
  const format = 'webp';
  const results = {};

  if (type === 'cover') {
    results.original = await optimizeImage(buffer, { 
      width: 1920, 
      height: 600, 
      format, 
      quality: QUALITY.high,
      fit: 'cover'
    });
    results.medium = await optimizeImage(buffer, { 
      width: 800, 
      height: 250, 
      format, 
      quality: QUALITY.medium,
      fit: 'cover'
    });
    results.thumbnail = await optimizeImage(buffer, { 
      width: 400, 
      height: 125, 
      format, 
      quality: QUALITY.medium,
      fit: 'cover'
    });
  } else if (type === 'gallery') {
    results.original = await optimizeImage(buffer, { 
      width: 1200, 
      height: 1200, 
      format, 
      quality: QUALITY.high 
    });
    results.medium = await optimizeImage(buffer, { 
      width: 600, 
      height: 600, 
      format, 
      quality: QUALITY.medium 
    });
    results.thumbnail = await optimizeImage(buffer, { 
      width: 150, 
      height: 150, 
      format, 
      quality: QUALITY.low 
    });
  }

  results.placeholder = await createPlaceholder(buffer);
  return results;
};

module.exports = {
  optimizeImage,
  generateImageSizes,
  getImageMetadata,
  validateImageDimensions,
  createPlaceholder,
  processCategoryImage,
  processCompetitionImage,
  IMAGE_SIZES,
  QUALITY
};
