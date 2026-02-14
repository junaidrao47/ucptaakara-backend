/**
 * =============================================================================
 * ADMIN COMPETITION CONTROLLER
 * =============================================================================
 * Handles CRUD operations for competitions
 * All endpoints require admin authentication
 * =============================================================================
 */

const mongoose = require('mongoose');
const Competition = require('../../models/Competition');
const Category = require('../../models/Category');
const Registration = require('../../models/Registration');
const cacheService = require('../../config/cache');
const { getPagination, formatPagination } = require('../../middleware/validators');
const { uploadToS3, deleteFromS3, generateS3Key, extractKeyFromUrl } = require('../../config/s3');
const { processCompetitionImage } = require('../../utils/imageOptimizer');

// Cache keys
const CACHE_KEYS = {
  FEATURED: 'competitions:featured',
  TRENDING: 'competitions:trending',
  COMPETITION_PREFIX: 'competition:'
};

// =============================================================================
// CREATE COMPETITION
// =============================================================================

/**
 * @desc    Create a new competition
 * @route   POST /api/admin/competitions
 * @access  Admin
 */
const createCompetition = async (req, res) => {
  try {
    const {
      title,
      description,
      shortDescription,
      category,
      deadline,
      startDate,
      endDate,
      maxRegistrations,
      venue,
      isOnline,
      type,
      teamSize,
      prizes,
      requirements,
      rules,
      faqs,
      tags,
      banner,
      thumbnail,
      externalLink,
      contactEmail,
      organizer,
      sponsors,
      isFeatured,
      status
    } = req.body;

    // Verify category exists
    const categoryExists = await Category.findOne({ 
      _id: category, 
      isActive: true 
    });
    
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive category'
      });
    }

    // Create competition
    const competition = await Competition.create({
      title,
      description,
      shortDescription,
      category,
      deadline: new Date(deadline),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      maxRegistrations,
      venue,
      isOnline,
      type,
      teamSize,
      prizes,
      requirements,
      rules,
      faqs,
      tags,
      banner,
      thumbnail,
      externalLink,
      contactEmail,
      organizer,
      sponsors,
      isFeatured,
      status: status || 'draft',
      createdBy: req.user.id
    });

    // Process and upload images if provided
    const files = req.files;
    const images = {};

    if (files && (files.cover || files.gallery)) {
      // Process cover image
      if (files.cover && files.cover[0]) {
        const coverFile = files.cover[0];
        const processed = await processCompetitionImage(coverFile.buffer, 'cover');
        
        const coverKey = generateS3Key('competitions', competition._id.toString(), 'cover.webp');
        const coverResult = await uploadToS3(processed.original, coverKey, 'image/webp');
        
        const coverMediumKey = generateS3Key('competitions', competition._id.toString(), 'cover-medium.webp');
        const coverMediumResult = await uploadToS3(processed.medium, coverMediumKey, 'image/webp');
        
        const coverThumbKey = generateS3Key('competitions', competition._id.toString(), 'cover-thumb.webp');
        const coverThumbResult = await uploadToS3(processed.thumbnail, coverThumbKey, 'image/webp');

        images.cover = {
          url: coverResult.url,
          medium: coverMediumResult.url,
          thumbnail: coverThumbResult.url,
          placeholder: processed.placeholder
        };
      }

      // Process gallery images
      if (files.gallery && files.gallery.length > 0) {
        images.gallery = [];
        
        for (const galleryFile of files.gallery) {
          const processed = await processCompetitionImage(galleryFile.buffer, 'gallery');
          
          const galleryKey = generateS3Key('competitions', competition._id.toString(), `gallery-${Date.now()}.webp`);
          const galleryResult = await uploadToS3(processed.original, galleryKey, 'image/webp');
          
          const galleryMediumKey = generateS3Key('competitions', competition._id.toString(), `gallery-medium-${Date.now()}.webp`);
          const galleryMediumResult = await uploadToS3(processed.medium, galleryMediumKey, 'image/webp');
          
          const galleryThumbKey = generateS3Key('competitions', competition._id.toString(), `gallery-thumb-${Date.now()}.webp`);
          const galleryThumbResult = await uploadToS3(processed.thumbnail, galleryThumbKey, 'image/webp');

          images.gallery.push({
            url: galleryResult.url,
            medium: galleryMediumResult.url,
            thumbnail: galleryThumbResult.url,
            placeholder: processed.placeholder
          });
        }
      }

      // Update competition with images
      if (Object.keys(images).length > 0) {
        competition.images = images;
        await competition.save();
      }
    }

    // Update category competition count
    await Category.updateCompetitionCount(category, 1);

    // Invalidate caches
    await Promise.all([
      cacheService.delete(CACHE_KEYS.FEATURED),
      cacheService.delete(CACHE_KEYS.TRENDING)
    ]);

    return res.status(201).json({
      success: true,
      message: 'Competition created successfully',
      data: competition
    });

  } catch (error) {
    console.error('Create competition error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create competition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET ALL COMPETITIONS (Admin view)
// =============================================================================

/**
 * @desc    Get all competitions with full details
 * @route   GET /api/admin/competitions
 * @access  Admin
 */
const getAllCompetitions = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20 });
    const { search, category, status, sort } = req.query;

    // Build filter
    const filter = { isDeleted: false };
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) {
      filter.category = category;
    }
    if (status) {
      filter.status = status;
    }

    // Build sort
    let sortObj = Competition.buildSort(sort);

    // Execute query
    const [competitions, total] = await Promise.all([
      Competition.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .select('title slug status deadline category registrationsCount viewsCount isFeatured createdAt thumbnail')
        .populate('category', 'name slug color')
        .populate('createdBy', 'name email')
        .lean(),
      Competition.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        competitions,
        pagination: formatPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get competitions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch competitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET SINGLE COMPETITION
// =============================================================================

/**
 * @desc    Get competition by ID with full details
 * @route   GET /api/admin/competitions/:id
 * @access  Admin
 */
const getCompetitionById = async (req, res) => {
  try {
    const competition = await Competition.findOne({
      _id: req.params.id,
      isDeleted: false
    })
      .populate('category', 'name slug color')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    // Get registration stats
    const registrationStats = await Registration.getCompetitionStats(competition._id);

    return res.status(200).json({
      success: true,
      data: {
        ...competition,
        registrationStats
      }
    });

  } catch (error) {
    console.error('Get competition error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch competition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// UPDATE COMPETITION
// =============================================================================

/**
 * @desc    Update competition
 * @route   PUT /api/admin/competitions/:id
 * @access  Admin
 */
const updateCompetition = async (req, res) => {
  try {
    const competitionId = req.params.id;
    const updateData = req.body;

    // Find competition
    const competition = await Competition.findOne({
      _id: competitionId,
      isDeleted: false
    });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    // If changing category, verify new category exists
    if (updateData.category && updateData.category !== competition.category.toString()) {
      const categoryExists = await Category.findOne({
        _id: updateData.category,
        isActive: true
      });

      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive category'
        });
      }

      // Update category competition counts
      await Promise.all([
        Category.updateCompetitionCount(competition.category, -1),
        Category.updateCompetitionCount(updateData.category, 1)
      ]);
    }

    // Convert date strings to Date objects
    if (updateData.deadline) updateData.deadline = new Date(updateData.deadline);
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

    // Update competition
    updateData.updatedBy = req.user.id;
    Object.assign(competition, updateData);

    // Process and upload images if provided
    const files = req.files;
    const oldImages = [];

    if (files && (files.cover || files.gallery)) {
      if (!competition.images) competition.images = {};

      // Process cover image
      if (files.cover && files.cover[0]) {
        const coverFile = files.cover[0];
        const processed = await processCompetitionImage(coverFile.buffer, 'cover');
        
        const coverKey = generateS3Key('competitions', competitionId, 'cover.webp');
        const coverResult = await uploadToS3(processed.original, coverKey, 'image/webp');
        
        const coverMediumKey = generateS3Key('competitions', competitionId, 'cover-medium.webp');
        const coverMediumResult = await uploadToS3(processed.medium, coverMediumKey, 'image/webp');
        
        const coverThumbKey = generateS3Key('competitions', competitionId, 'cover-thumb.webp');
        const coverThumbResult = await uploadToS3(processed.thumbnail, coverThumbKey, 'image/webp');

        // Track old images for deletion
        if (competition.images.cover?.url) oldImages.push(extractKeyFromUrl(competition.images.cover.url));
        if (competition.images.cover?.medium) oldImages.push(extractKeyFromUrl(competition.images.cover.medium));
        if (competition.images.cover?.thumbnail) oldImages.push(extractKeyFromUrl(competition.images.cover.thumbnail));

        competition.images.cover = {
          url: coverResult.url,
          medium: coverMediumResult.url,
          thumbnail: coverThumbResult.url,
          placeholder: processed.placeholder
        };
      }

      // Process gallery images (append to existing)
      if (files.gallery && files.gallery.length > 0) {
        if (!competition.images.gallery) competition.images.gallery = [];
        
        for (const galleryFile of files.gallery) {
          const processed = await processCompetitionImage(galleryFile.buffer, 'gallery');
          
          const galleryKey = generateS3Key('competitions', competitionId, `gallery-${Date.now()}.webp`);
          const galleryResult = await uploadToS3(processed.original, galleryKey, 'image/webp');
          
          const galleryMediumKey = generateS3Key('competitions', competitionId, `gallery-medium-${Date.now()}.webp`);
          const galleryMediumResult = await uploadToS3(processed.medium, galleryMediumKey, 'image/webp');
          
          const galleryThumbKey = generateS3Key('competitions', competitionId, `gallery-thumb-${Date.now()}.webp`);
          const galleryThumbResult = await uploadToS3(processed.thumbnail, galleryThumbKey, 'image/webp');

          competition.images.gallery.push({
            url: galleryResult.url,
            medium: galleryMediumResult.url,
            thumbnail: galleryThumbResult.url,
            placeholder: processed.placeholder
          });
        }
      }

      // Delete old cover images from S3 (async)
      oldImages.filter(Boolean).forEach(key => deleteFromS3(key));
    }

    await competition.save();

    // Invalidate caches
    await Promise.all([
      cacheService.delete(CACHE_KEYS.FEATURED),
      cacheService.delete(CACHE_KEYS.TRENDING),
      cacheService.delete(`${CACHE_KEYS.COMPETITION_PREFIX}${competitionId}`)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Competition updated successfully',
      data: competition
    });

  } catch (error) {
    console.error('Update competition error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update competition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// DELETE COMPETITION
// =============================================================================

/**
 * @desc    Delete competition (soft delete)
 * @route   DELETE /api/admin/competitions/:id
 * @access  Admin
 */
const deleteCompetition = async (req, res) => {
  try {
    const competitionId = req.params.id;

    const competition = await Competition.findOne({
      _id: competitionId,
      isDeleted: false
    });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    // Soft delete
    await competition.softDelete(req.user.id);

    // Update category competition count
    await Category.updateCompetitionCount(competition.category, -1);

    // Invalidate caches
    await Promise.all([
      cacheService.delete(CACHE_KEYS.FEATURED),
      cacheService.delete(CACHE_KEYS.TRENDING),
      cacheService.delete(`${CACHE_KEYS.COMPETITION_PREFIX}${competitionId}`)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Competition deleted successfully'
    });

  } catch (error) {
    console.error('Delete competition error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete competition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// PUBLISH COMPETITION
// =============================================================================

/**
 * @desc    Publish a draft competition
 * @route   PATCH /api/admin/competitions/:id/publish
 * @access  Admin
 */
const publishCompetition = async (req, res) => {
  try {
    const competitionId = req.params.id;

    const competition = await Competition.findOne({
      _id: competitionId,
      isDeleted: false
    });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    if (competition.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Competition is already published'
      });
    }

    // Validate competition has required fields for publishing
    if (competition.deadline <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish competition with past deadline'
      });
    }

    await competition.publish(req.user.id);

    // Invalidate caches
    await Promise.all([
      cacheService.delete(CACHE_KEYS.FEATURED),
      cacheService.delete(CACHE_KEYS.TRENDING)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Competition published successfully',
      data: competition
    });

  } catch (error) {
    console.error('Publish competition error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to publish competition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// FEATURE/UNFEATURE COMPETITION
// =============================================================================

/**
 * @desc    Toggle featured status
 * @route   PATCH /api/admin/competitions/:id/feature
 * @access  Admin
 */
const toggleFeatured = async (req, res) => {
  try {
    const competitionId = req.params.id;

    const competition = await Competition.findOne({
      _id: competitionId,
      isDeleted: false
    });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    competition.isFeatured = !competition.isFeatured;
    competition.updatedBy = req.user.id;
    await competition.save();

    // Invalidate featured cache
    await cacheService.delete(CACHE_KEYS.FEATURED);

    return res.status(200).json({
      success: true,
      message: competition.isFeatured ? 'Competition featured' : 'Competition unfeatured',
      data: { isFeatured: competition.isFeatured }
    });

  } catch (error) {
    console.error('Toggle featured error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update featured status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET COMPETITION REGISTRATIONS
// =============================================================================

/**
 * @desc    Get registrations for a competition
 * @route   GET /api/admin/competitions/:id/registrations
 * @access  Admin
 */
const getCompetitionRegistrations = async (req, res) => {
  try {
    const competitionId = req.params.id;
    const { status, page, limit, search } = req.query;

    // Verify competition exists
    const competition = await Competition.findOne({
      _id: competitionId,
      isDeleted: false
    }).select('title');

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    const result = await Registration.getCompetitionRegistrations(competitionId, {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      search
    });

    return res.status(200).json({
      success: true,
      data: {
        competition: competition.title,
        ...result
      }
    });

  } catch (error) {
    console.error('Get competition registrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// DUPLICATE COMPETITION
// =============================================================================

/**
 * @desc    Duplicate an existing competition
 * @route   POST /api/admin/competitions/:id/duplicate
 * @access  Admin
 */
const duplicateCompetition = async (req, res) => {
  try {
    const competitionId = req.params.id;

    const original = await Competition.findOne({
      _id: competitionId,
      isDeleted: false
    }).lean();

    if (!original) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    // Remove fields that shouldn't be duplicated
    delete original._id;
    delete original.slug;
    delete original.createdAt;
    delete original.updatedAt;
    delete original.registrationsCount;
    delete original.viewsCount;
    delete original.__v;

    // Create new competition
    const duplicate = await Competition.create({
      ...original,
      title: `${original.title} (Copy)`,
      status: 'draft',
      isFeatured: false,
      createdBy: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Competition duplicated successfully',
      data: duplicate
    });

  } catch (error) {
    console.error('Duplicate competition error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to duplicate competition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createCompetition,
  getAllCompetitions,
  getCompetitionById,
  updateCompetition,
  deleteCompetition,
  publishCompetition,
  toggleFeatured,
  getCompetitionRegistrations,
  duplicateCompetition
};
