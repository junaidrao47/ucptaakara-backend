/**
 * =============================================================================
 * PUBLIC COMPETITION CONTROLLER
 * =============================================================================
 * Public endpoints for browsing and viewing competitions
 * 
 * Features:
 * - Advanced filtering (category, date range, type)
 * - Full-text search
 * - Multiple sort options (most registrations, trending, new)
 * - Pagination
 * - Calendar view support
 * - Lazy loading optimized responses
 * =============================================================================
 */

const Competition = require('../models/Competition');
const Category = require('../models/Category');
const cacheService = require('../config/cache');
const { getPagination, formatPagination } = require('../middleware/validators');

// Cache configuration
const CACHE_KEYS = {
  FEATURED: 'competitions:featured',
  TRENDING: 'competitions:trending'
};
const CACHE_TTL = {
  FEATURED: 600,  // 10 minutes
  TRENDING: 300,  // 5 minutes
  DETAIL: 1800    // 30 minutes
};

// =============================================================================
// GET COMPETITIONS WITH FILTERS
// =============================================================================

/**
 * @desc    Get competitions with advanced filtering
 * @route   GET /api/competitions
 * @access  Public
 * 
 * @query   {string} category - Filter by category ID
 * @query   {string} search - Full-text search
 * @query   {string} sort - Sort option (most|trending|new|deadline|prize)
 * @query   {string} startDate - Filter deadline >= startDate
 * @query   {string} endDate - Filter deadline <= endDate
 * @query   {string} type - Filter by type (individual|team)
 * @query   {boolean} isOnline - Filter online competitions
 * @query   {boolean} featured - Featured only
 * @query   {boolean} active - Active only (deadline not passed)
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 10, max: 100)
 */
const getCompetitions = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { sort } = req.query;

    // Build filter
    let filter = Competition.buildQuery(req.query);

    // Handle trending sort (last 7 days)
    if (sort === 'trending') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filter.createdAt = { $gte: sevenDaysAgo };
    }

    // Build sort
    const sortObj = Competition.buildSort(sort);

    // Select fields for lazy loading (minimal data for list view)
    const selectFields = [
      'title',
      'slug',
      'shortDescription',
      'thumbnail',
      'deadline',
      'category',
      'registrationsCount',
      'maxRegistrations',
      'totalPrizePool',
      'prizeCurrency',
      'type',
      'isOnline',
      'isFeatured',
      'tags'
    ].join(' ');

    // Execute query
    const [competitions, total] = await Promise.all([
      Competition.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .select(selectFields)
        .populate('category', 'name slug color')
        .lean(),
      Competition.countDocuments(filter)
    ]);

    // Add computed fields
    const now = new Date();
    const enrichedCompetitions = competitions.map(comp => ({
      ...comp,
      isRegistrationOpen: comp.deadline > now &&
        (comp.maxRegistrations === 0 || comp.registrationsCount < comp.maxRegistrations),
      daysUntilDeadline: Math.ceil((comp.deadline - now) / (1000 * 60 * 60 * 24)),
      registrationProgress: comp.maxRegistrations > 0
        ? Math.round((comp.registrationsCount / comp.maxRegistrations) * 100)
        : null
    }));

    return res.status(200).json({
      success: true,
      data: {
        competitions: enrichedCompetitions,
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
 * @desc    Get competition by ID or slug
 * @route   GET /api/competitions/:identifier
 * @access  Public
 */
const getCompetitionByIdentifier = async (req, res) => {
  try {
    const { identifier } = req.params;

    // Check cache first
    const cacheKey = `competition:${identifier}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Determine if identifier is ObjectId or slug
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    const query = isObjectId
      ? { _id: identifier, isDeleted: false, status: 'published' }
      : { slug: identifier, isDeleted: false, status: 'published' };

    const competition = await Competition.findOne(query)
      .populate('category', 'name slug color description')
      .lean();

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    // Increment view count (fire and forget)
    Competition.incrementViews(competition._id).catch(console.error);

    // Add computed fields
    const now = new Date();
    const enrichedCompetition = {
      ...competition,
      isRegistrationOpen: competition.deadline > now &&
        (competition.maxRegistrations === 0 || 
         competition.registrationsCount < competition.maxRegistrations),
      daysUntilDeadline: Math.ceil((competition.deadline - now) / (1000 * 60 * 60 * 24)),
      registrationProgress: competition.maxRegistrations > 0
        ? Math.round((competition.registrationsCount / competition.maxRegistrations) * 100)
        : null
    };

    // Cache result
    await cacheService.set(cacheKey, enrichedCompetition, CACHE_TTL.DETAIL);

    return res.status(200).json({
      success: true,
      data: enrichedCompetition,
      cached: false
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
// GET FEATURED COMPETITIONS
// =============================================================================

/**
 * @desc    Get featured competitions for homepage
 * @route   GET /api/competitions/featured
 * @access  Public
 */
const getFeaturedCompetitions = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    // Check cache
    const cached = await cacheService.get(CACHE_KEYS.FEATURED);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached.slice(0, parseInt(limit)),
        cached: true
      });
    }

    const competitions = await Competition.findFeatured(10); // Cache more than needed

    // Cache results
    await cacheService.set(CACHE_KEYS.FEATURED, competitions, CACHE_TTL.FEATURED);

    return res.status(200).json({
      success: true,
      data: competitions.slice(0, parseInt(limit)),
      cached: false
    });

  } catch (error) {
    console.error('Get featured competitions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch featured competitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET TRENDING COMPETITIONS
// =============================================================================

/**
 * @desc    Get trending competitions (most registrations in last 7 days)
 * @route   GET /api/competitions/trending
 * @access  Public
 */
const getTrendingCompetitions = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Check cache
    const cached = await cacheService.get(CACHE_KEYS.TRENDING);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached.slice(0, parseInt(limit)),
        cached: true
      });
    }

    const competitions = await Competition.findTrending(15); // Cache more than needed

    // Cache results
    await cacheService.set(CACHE_KEYS.TRENDING, competitions, CACHE_TTL.TRENDING);

    return res.status(200).json({
      success: true,
      data: competitions.slice(0, parseInt(limit)),
      cached: false
    });

  } catch (error) {
    console.error('Get trending competitions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch trending competitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET CALENDAR VIEW
// =============================================================================

/**
 * @desc    Get competitions for calendar view
 * @route   GET /api/competitions/calendar
 * @access  Public
 * 
 * @query   {number} month - Month (1-12)
 * @query   {number} year - Year
 */
const getCalendarCompetitions = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }

    const cacheKey = `competitions:calendar:${year}-${month}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const competitions = await Competition.getCalendarView(
      parseInt(month),
      parseInt(year)
    );

    // Group by date for easier frontend rendering
    const groupedByDate = {};
    competitions.forEach(comp => {
      const dateKey = comp.deadline.toISOString().split('T')[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push({
        _id: comp._id,
        title: comp.title,
        slug: comp.slug,
        thumbnail: comp.thumbnail,
        category: comp.category,
        deadline: comp.deadline
      });
    });

    const result = {
      month: parseInt(month),
      year: parseInt(year),
      competitions,
      byDate: groupedByDate,
      total: competitions.length
    };

    // Cache for 1 hour
    await cacheService.set(cacheKey, result, 3600);

    return res.status(200).json({
      success: true,
      data: result,
      cached: false
    });

  } catch (error) {
    console.error('Get calendar competitions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch calendar data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET UPCOMING COMPETITIONS
// =============================================================================

/**
 * @desc    Get upcoming competitions (sorted by deadline)
 * @route   GET /api/competitions/upcoming
 * @access  Public
 */
const getUpcomingCompetitions = async (req, res) => {
  try {
    const { limit = 10, category } = req.query;

    const filter = {
      isDeleted: false,
      status: 'published',
      deadline: { $gte: new Date() }
    };

    if (category) {
      filter.category = category;
    }

    const competitions = await Competition.find(filter)
      .sort({ deadline: 1 })
      .limit(parseInt(limit))
      .select('title slug shortDescription thumbnail deadline category registrationsCount')
      .populate('category', 'name slug color')
      .lean();

    return res.status(200).json({
      success: true,
      data: competitions
    });

  } catch (error) {
    console.error('Get upcoming competitions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming competitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// SEARCH SUGGESTIONS
// =============================================================================

/**
 * @desc    Get search suggestions for autocomplete
 * @route   GET /api/competitions/suggestions
 * @access  Public
 */
const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const suggestions = await Competition.find({
      isDeleted: false,
      status: 'published',
      deadline: { $gte: new Date() },
      title: { $regex: q, $options: 'i' }
    })
      .select('title slug category')
      .populate('category', 'name')
      .limit(5)
      .lean();

    return res.status(200).json({
      success: true,
      data: suggestions.map(s => ({
        title: s.title,
        slug: s.slug,
        category: s.category?.name
      }))
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch suggestions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// GET RELATED COMPETITIONS
// =============================================================================

/**
 * @desc    Get related competitions based on category
 * @route   GET /api/competitions/:id/related
 * @access  Public
 */
const getRelatedCompetitions = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;

    // Get the current competition
    const competition = await Competition.findById(id).select('category');
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition not found'
      });
    }

    // Find related competitions in same category
    const related = await Competition.find({
      _id: { $ne: id },
      category: competition.category,
      isDeleted: false,
      status: 'published',
      deadline: { $gte: new Date() }
    })
      .sort({ registrationsCount: -1 })
      .limit(parseInt(limit))
      .select('title slug shortDescription thumbnail deadline category registrationsCount')
      .populate('category', 'name slug color')
      .lean();

    return res.status(200).json({
      success: true,
      data: related
    });

  } catch (error) {
    console.error('Get related competitions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch related competitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getCompetitions,
  getCompetitionByIdentifier,
  getFeaturedCompetitions,
  getTrendingCompetitions,
  getCalendarCompetitions,
  getUpcomingCompetitions,
  getSearchSuggestions,
  getRelatedCompetitions
};
