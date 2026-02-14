/**
 * =============================================================================
 * AWS S3 CONFIGURATION
 * =============================================================================
 * Configures AWS S3 client for file uploads
 * =============================================================================
 */

const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

// S3 Client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'YOUR_SECRET_ACCESS_KEY'
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'ucp-takra-uploads';
const CDN_URL = process.env.AWS_S3_BASE_URL || `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {string} key - S3 object key (path/filename)
 * @param {string} contentType - MIME type of the file
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Object>} Upload result with URL
 */
const uploadToS3 = async (fileBuffer, key, contentType, metadata = {}) => {
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'public-read',
        Metadata: metadata,
        CacheControl: 'max-age=31536000' // 1 year cache
      }
    });

    const result = await upload.done();
    
    return {
      success: true,
      key: key,
      url: `${CDN_URL}/${key}`,
      etag: result.ETag,
      location: result.Location
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>}
 */
const deleteFromS3 = async (key) => {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    return false;
  }
};

/**
 * Delete multiple files from S3
 * @param {string[]} keys - Array of S3 object keys
 * @returns {Promise<Object>}
 */
const deleteMultipleFromS3 = async (keys) => {
  const results = { deleted: [], failed: [] };
  
  for (const key of keys) {
    const success = await deleteFromS3(key);
    if (success) {
      results.deleted.push(key);
    } else {
      results.failed.push(key);
    }
  }
  
  return results;
};

/**
 * Generate S3 key for different upload types
 * @param {string} type - Upload type (category, competition, user)
 * @param {string} id - Entity ID
 * @param {string} filename - Original filename
 * @returns {string} S3 key
 */
const generateS3Key = (type, id, filename) => {
  const timestamp = Date.now();
  const ext = filename.split('.').pop().toLowerCase();
  return `${type}/${id}/${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;
};

/**
 * Extract S3 key from URL
 * @param {string} url - Full S3 URL
 * @returns {string|null} S3 key
 */
const extractKeyFromUrl = (url) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading /
  } catch {
    return null;
  }
};

module.exports = {
  s3Client,
  uploadToS3,
  deleteFromS3,
  deleteMultipleFromS3,
  generateS3Key,
  extractKeyFromUrl,
  BUCKET_NAME,
  CDN_URL
};
