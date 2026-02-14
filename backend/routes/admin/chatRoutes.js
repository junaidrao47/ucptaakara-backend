/**
 * =============================================================================
 * ADMIN CHAT ROUTES
 * =============================================================================
 * REST API routes for admin/support staff to manage chat
 *
 * Base path: /api/admin/chat
 *
 * Routes:
 *   GET    /conversations              - List all conversations
 *   GET    /conversations/:id          - Get conversation details
 *   GET    /conversations/:id/messages - Get conversation messages
 *   POST   /conversations/:id/messages - Reply to a conversation
 *   PATCH  /conversations/:id/close    - Close a conversation
 *   PATCH  /conversations/:id/reopen   - Reopen a conversation
 *   GET    /stats                      - Get chat statistics
 *
 * Auth handled by parent admin router (admin/support role).
 * =============================================================================
 */

const express = require('express');
const router = express.Router();

// Controller
const {
  getAllConversations,
  getConversation,
  getMessages,
  replyToConversation,
  closeConversation,
  reopenConversation,
  getChatStats
} = require('../../controllers/admin/chatController');

// =============================================================================
// STATS
// =============================================================================

/**
 * @route   GET /api/admin/chat/stats
 * @desc    Get chat module statistics
 * @access  Admin, Support
 */
router.get('/stats', getChatStats);

// =============================================================================
// CONVERSATION ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/chat/conversations
 * @desc    List all conversations with filters
 * @access  Admin, Support
 */
router.get('/conversations', getAllConversations);

/**
 * @route   GET /api/admin/chat/conversations/:id
 * @desc    Get single conversation details
 * @access  Admin, Support
 */
router.get('/conversations/:id', getConversation);

/**
 * @route   GET /api/admin/chat/conversations/:id/messages
 * @desc    Get paginated messages
 * @access  Admin, Support
 */
router.get('/conversations/:id/messages', getMessages);

/**
 * @route   POST /api/admin/chat/conversations/:id/messages
 * @desc    Reply to a conversation
 * @access  Admin, Support
 */
router.post('/conversations/:id/messages', replyToConversation);

/**
 * @route   PATCH /api/admin/chat/conversations/:id/close
 * @desc    Close a conversation
 * @access  Admin, Support
 */
router.patch('/conversations/:id/close', closeConversation);

/**
 * @route   PATCH /api/admin/chat/conversations/:id/reopen
 * @desc    Reopen a closed conversation
 * @access  Admin, Support
 */
router.patch('/conversations/:id/reopen', reopenConversation);

module.exports = router;
