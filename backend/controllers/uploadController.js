/**
 * =============================================================================
 * UPLOAD CONTROLLER
 * =============================================================================
 * Handles file uploads for categories and competitions
 * =============================================================================
 */

const { uploadToS3, deleteFromS3, generateS3Key, extractKeyFromUrl } = require('../config/s3');
const { processCategoryImage, processCompetitionImage, getImageMetadata } = require('../utils/imageOptimizer');
const Category = require('../models/Category');
const Competition = require('../models/Competition');

// =============================================================================
// CATEGORY IMAGE UPLOAD
// =============================================================================

/**
 * @desc    Upload category images (icon and/or banner)
 * @route   POST /api/uploads/category/:id
 * @access  Admin
 */
const uploadCategoryImage = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || (!files.icon && !files.banner)) {
      return res.status(400).json({
        success: false,
        message: 'No images provided. Upload icon and/or banner.'
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const uploadedImages = {};
    const oldImages = [];

    // Process and upload icon
    if (files.icon && files.icon[0]) {
      const iconFile = files.icon[0];
      const processed = await processCategoryImage(iconFile.buffer, 'icon');
      
      // Upload original
      const iconKey = generateS3Key('categories', id, 'icon.webp');
      const iconResult = await uploadToS3(processed.original, iconKey, 'image/webp');
      
      // Upload thumbnail
      const iconThumbKey = generateS3Key('categories', id, 'icon-thumb.webp');
      const iconThumbResult = await uploadToS3(processed.thumbnail, iconThumbKey, 'image/webp');

      // Store old image for deletion
      if (category.images?.icon?.url) {
        oldImages.push(extractKeyFromUrl(category.images.icon.url));
      }
      if (category.images?.icon?.thumbnail) {
        oldImages.push(extractKeyFromUrl(category.images.icon.thumbnail));
      }

      uploadedImages.icon = {
        url: iconResult.url,
        thumbnail: iconThumbResult.url,
        placeholder: processed.placeholder
      };
    }

    // Process and upload banner
    if (files.banner && files.banner[0]) {
      const bannerFile = files.banner[0];
      const processed = await processCategoryImage(bannerFile.buffer, 'banner');
      
      const bannerKey = generateS3Key('categories', id, 'banner.webp');
      const bannerResult = await uploadToS3(processed.original, bannerKey, 'image/webp');
      
      const bannerThumbKey = generateS3Key('categories', id, 'banner-thumb.webp');
      const bannerThumbResult = await uploadToS3(processed.thumbnail, bannerThumbKey, 'image/webp');

      if (category.images?.banner?.url) {
        oldImages.push(extractKeyFromUrl(category.images.banner.url));
      }
      if (category.images?.banner?.thumbnail) {
        oldImages.push(extractKeyFromUrl(category.images.banner.thumbnail));
      }

      uploadedImages.banner = {
        url: bannerResult.url,
        thumbnail: bannerThumbResult.url,
        placeholder: processed.placeholder
      };
    }

    // Update category with new images
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { 
        $set: { 
          'images.icon': uploadedImages.icon || category.images?.icon,
          'images.banner': uploadedImages.banner || category.images?.banner
        }
      },
      { new: true }
    );

    // Delete old images from S3 (async, don't wait)
    oldImages.filter(Boolean).forEach(key => deleteFromS3(key));

    return res.status(200).json({
      success: true,
      message: 'Category images uploaded successfully',
      data: {
        images: updatedCategory.images
      }
    });

  } catch (error) {
    console.error('Upload category image error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// COMPETITION IMAGE UPLOAD
// =============================================================================

/**
 * @desc    Upload competition images (cover and/or gallery)
 * @route   POST /api/uploads/competition/:id
 * @access  Admin
 */
const uploadCompetitionImage = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || (!files.cover && !files.gallery)) {
      return res.status(400).json({
        success: false,
        message: 'No images provided. Upload cover and/or gallery images.'
      });
    }

    const competition = await Competition.findById(id);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    const uploadedImages = {};
    const oldImages = [];

    // Process and upload cover
    if (files.cover && files.cover[0]) {
      const coverFile = files.cover[0];
      const processed = await processCompetitionImage(coverFile.buffer, 'cover');
      
      const coverKey = generateS3Key('competitions', id, 'cover.webp');
      const coverResult = await uploadToS3(processed.original, coverKey, 'image/webp');
      
      const coverMediumKey = generateS3Key('competitions', id, 'cover-medium.webp');
      const coverMediumResult = await uploadToS3(processed.medium, coverMediumKey, 'image/webp');
      
      const coverThumbKey = generateS3Key('competitions', id, 'cover-thumb.webp');
      const coverThumbResult = await uploadToS3(processed.thumbnail, coverThumbKey, 'image/webp');

      // Store old images for deletion
      if (competition.images?.cover?.url) {
        oldImages.push(extractKeyFromUrl(competition.images.cover.url));
      }
      if (competition.images?.cover?.medium) {
        oldImages.push(extractKeyFromUrl(competition.images.cover.medium));
      }
      if (competition.images?.cover?.thumbnail) {
        oldImages.push(extractKeyFromUrl(competition.images.cover.thumbnail));
      }

      uploadedImages.cover = {
        url: coverResult.url,
        medium: coverMediumResult.url,
        thumbnail: coverThumbResult.url,
        placeholder: processed.placeholder
      };
    }

    // Process and upload gallery images
    if (files.gallery && files.gallery.length > 0) {
      uploadedImages.gallery = [];
      
      for (const galleryFile of files.gallery) {
        const processed = await processCompetitionImage(galleryFile.buffer, 'gallery');
        
        const galleryKey = generateS3Key('competitions', id, `gallery-${Date.now()}.webp`);
        const galleryResult = await uploadToS3(processed.original, galleryKey, 'image/webp');
        
        const galleryMediumKey = generateS3Key('competitions', id, `gallery-medium-${Date.now()}.webp`);
        const galleryMediumResult = await uploadToS3(processed.medium, galleryMediumKey, 'image/webp');
        
        const galleryThumbKey = generateS3Key('competitions', id, `gallery-thumb-${Date.now()}.webp`);
        const galleryThumbResult = await uploadToS3(processed.thumbnail, galleryThumbKey, 'image/webp');

        uploadedImages.gallery.push({
          url: galleryResult.url,
          medium: galleryMediumResult.url,
          thumbnail: galleryThumbResult.url,
          placeholder: processed.placeholder
        });
      }
    }

    // Update competition
    const updateData = {};
    if (uploadedImages.cover) {
      updateData['images.cover'] = uploadedImages.cover;
    }
    if (uploadedImages.gallery) {
      // Append to existing gallery or replace
      const existingGallery = competition.images?.gallery || [];
      updateData['images.gallery'] = [...existingGallery, ...uploadedImages.gallery];
    }

    const updatedCompetition = await Competition.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    // Delete old cover images
    oldImages.filter(Boolean).forEach(key => deleteFromS3(key));

    return res.status(200).json({
      success: true,
      message: 'Competition images uploaded successfully',
      data: {
        images: updatedCompetition.images
      }
    });

  } catch (error) {
    console.error('Upload competition image error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// DELETE GALLERY IMAGE
// =============================================================================

/**
 * @desc    Delete a gallery image from competition
 * @route   DELETE /api/uploads/competition/:id/gallery/:imageIndex
 * @access  Admin
 */
const deleteGalleryImage = async (req, res) => {
  try {
    const { id, imageIndex } = req.params;
    const index = parseInt(imageIndex);

    const competition = await Competition.findById(id);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    const gallery = competition.images?.gallery || [];
    if (index < 0 || index >= gallery.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gallery image index'
      });
    }

    const imageToDelete = gallery[index];

    // Delete from S3
    const keysToDelete = [
      extractKeyFromUrl(imageToDelete.url),
      extractKeyFromUrl(imageToDelete.medium),
      extractKeyFromUrl(imageToDelete.thumbnail)
    ].filter(Boolean);

    keysToDelete.forEach(key => deleteFromS3(key));

    // Remove from gallery array
    gallery.splice(index, 1);
    
    await Competition.findByIdAndUpdate(id, {
      $set: { 'images.gallery': gallery }
    });

    return res.status(200).json({
      success: true,
      message: 'Gallery image deleted successfully'
    });

  } catch (error) {
    console.error('Delete gallery image error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GENERIC IMAGE UPLOAD
// =============================================================================

/**
 * @desc    Upload a single image (generic)
 * @route   POST /api/uploads/image
 * @access  Authenticated
 */
const uploadGenericImage = async (req, res) => {
  try {
    const file = req.file;
    const { folder = 'misc' } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided'
      });
    }

    const metadata = await getImageMetadata(file.buffer);
    const key = generateS3Key(folder, req.user.id, file.originalname);
    const result = await uploadToS3(file.buffer, key, file.mimetype, {
      uploadedBy: req.user.id,
      originalName: file.originalname
    });

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
        key: result.key,
        metadata
      }
    });

  } catch (error) {
    console.error('Upload generic image error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  uploadCategoryImage,
  uploadCompetitionImage,
  deleteGalleryImage,
  uploadGenericImage
};
