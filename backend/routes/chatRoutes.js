/**
 * =============================================================================
 * CHAT ROUTES (User-facing)
 * =============================================================================
 * REST API routes for the real-time chat module
 *
 * Base path: /api/chat
 *
 * Routes:
 *   POST   /conversations              - Start / get a support conversation
 *   GET    /conversations              - List user's conversations
 *   GET    /conversations/:id          - Get single conversation
 *   GET    /conversations/:id/messages - Get paginated messages
 *   POST   /conversations/:id/messages - Send message (REST fallback)
 *   PATCH  /conversations/:id/read     - Mark messages as read
 *   GET    /unread-count               - Get total unread count
 *
 * All routes require JWT authentication.
 * =============================================================================
 */

const express = require('express');
const router = express.Router();

// Middleware
const authenticate = require('../middleware/auth');

// Controller
const {
  startConversation,
  getConversations,
  getConversation,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount
} = require('../controllers/chatController');

// ─── Apply authentication to all chat routes ────────────────────────────────
router.use(authenticate);

// =============================================================================
// CONVERSATION ROUTES
// =============================================================================

/**
 * @route   POST /api/chat/conversations
 * @desc    Start or retrieve an active support conversation
 * @access  Authenticated
 */
router.post('/conversations', startConversation);

/**
 * @route   GET /api/chat/conversations
 * @desc    List all user conversations (paginated)
 * @access  Authenticated
 */
router.get('/conversations', getConversations);

/**
 * @route   GET /api/chat/conversations/:id
 * @desc    Get single conversation details
 * @access  Authenticated (participant)
 */
router.get('/conversations/:id', getConversation);

/**
 * @route   GET /api/chat/conversations/:id/messages
 * @desc    Get paginated messages for a conversation
 * @access  Authenticated (participant)
 */
router.get('/conversations/:id/messages', getMessages);

/**
 * @route   POST /api/chat/conversations/:id/messages
 * @desc    Send a message via REST (WebSocket fallback)
 * @access  Authenticated (participant)
 */
router.post('/conversations/:id/messages', sendMessage);

/**
 * @route   PATCH /api/chat/conversations/:id/read
 * @desc    Mark all messages in conversation as read
 * @access  Authenticated (participant)
 */
router.patch('/conversations/:id/read', markAsRead);

// =============================================================================
// NOTIFICATION ROUTES
// =============================================================================

/**
 * @route   GET /api/chat/unread-count
 * @desc    Get total unread message count
 * @access  Authenticated
 */
router.get('/unread-count', getUnreadCount);

module.exports = router;
