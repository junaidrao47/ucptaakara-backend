/**
 * =============================================================================
 * CHAT CONTROLLER (User-facing)
 * =============================================================================
 * REST API endpoints for chat functionality
 *
 * Endpoints:
 *   POST   /api/chat/conversations          - Start / get a support conversation
 *   GET    /api/chat/conversations           - List user's conversations
 *   GET    /api/chat/conversations/:id       - Get single conversation details
 *   GET    /api/chat/conversations/:id/messages - Get paginated messages
 *   POST   /api/chat/conversations/:id/messages - Send message via REST
 *   PATCH  /api/chat/conversations/:id/read  - Mark conversation as read
 *   GET    /api/chat/unread-count            - Get total unread count
 *
 * All endpoints require authentication (JWT).
 * =============================================================================
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/UserSchema');
const { emitToUser, emitToConversation, isUserOnline } = require('../config/websocket');

// =============================================================================
// START OR GET CONVERSATION
// =============================================================================

/**
 * @desc    Start a new support conversation or return existing active one
 * @route   POST /api/chat/conversations
 * @access  Authenticated
 * @body    { subject?: string }
 */
const startConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject = 'Support Request' } = req.body;

    // Find an available support/admin staff member
    // Priority: support staff first, then admin
    let staffMember = await User.findOne({
      role: { $in: ['support', 'admin'] },
      _id: { $ne: userId }
    }).sort({ lastLogin: -1 }); // Most recently active

    if (!staffMember) {
      return res.status(503).json({
        success: false,
        message: 'No support staff available at the moment. Please try again later.'
      });
    }

    // Find or create conversation
    const conversation = await Conversation.findOrCreateConversation(
      userId,
      staffMember._id,
      'support',
      subject
    );

    // If the conversation was just created, send a system message
    const existingMessages = await Message.countDocuments({
      conversation: conversation._id
    });

    if (existingMessages === 0) {
      const systemMessage = await Message.create({
        conversation: conversation._id,
        sender: userId,
        content: `Conversation started: ${subject}`,
        type: 'system',
        readBy: [{ user: userId, readAt: new Date() }]
      });

      await Conversation.updateLastMessage(
        conversation._id,
        userId,
        `Conversation started: ${subject}`
      );

      // Notify staff member via WebSocket
      emitToUser(staffMember._id.toString(), 'new_conversation', {
        conversation: conversation.toObject(),
        message: systemMessage.toObject()
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation ready',
      data: {
        conversation
      }
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// LIST CONVERSATIONS
// =============================================================================

/**
 * @desc    Get all conversations for the authenticated user
 * @route   GET /api/chat/conversations
 * @access  Authenticated
 * @query   { page?: number, limit?: number, status?: string }
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const status = req.query.status || null;

    const { conversations, total } = await Conversation.getConversationsForUser(userId, {
      page,
      limit,
      status
    });

    // Enrich with online status
    const enriched = conversations.map((convo) => ({
      ...convo,
      participants: convo.participants.map((p) => ({
        ...p,
        isOnline: isUserOnline(p.user._id?.toString() || p.user.toString())
      }))
    }));

    return res.status(200).json({
      success: true,
      data: {
        conversations: enriched,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
};

// =============================================================================
// GET SINGLE CONVERSATION
// =============================================================================

/**
 * @desc    Get a single conversation by ID
 * @route   GET /api/chat/conversations/:id
 * @access  Authenticated (participant only)
 */
const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      'participants.user': req.user.id
    })
      .populate('participants.user', 'name email role avatar')
      .populate('lastMessage.sender', 'name')
      .lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Enrich with online status
    conversation.participants = conversation.participants.map((p) => ({
      ...p,
      isOnline: isUserOnline(p.user._id?.toString() || p.user.toString())
    }));

    return res.status(200).json({
      success: true,
      data: { conversation }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation'
    });
  }
};

// =============================================================================
// GET MESSAGES
// =============================================================================

/**
 * @desc    Get paginated messages for a conversation
 * @route   GET /api/chat/conversations/:id/messages
 * @access  Authenticated (participant only)
 * @query   { page?: number, limit?: number, before?: ISO-date }
 */
const getMessages = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before || null;

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': req.user.id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const { messages, total, hasMore } = await Message.getMessagesByConversation(
      conversationId,
      { page, limit, before }
    );

    return res.status(200).json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          hasMore
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

// =============================================================================
// SEND MESSAGE VIA REST
// =============================================================================

/**
 * @desc    Send a message via REST (fallback when WebSocket is unavailable)
 * @route   POST /api/chat/conversations/:id/messages
 * @access  Authenticated (participant only)
 * @body    { content: string, type?: string }
 */
const sendMessage = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    const { content, type = 'text' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    if (content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 2000 characters'
      });
    }

    // Verify participant access + active conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': userId,
      status: 'active'
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found, closed, or access denied'
      });
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content: content.trim(),
      type,
      readBy: [{ user: userId, readAt: new Date() }]
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email role avatar')
      .lean();

    // Update conversation metadata
    await Conversation.updateLastMessage(conversationId, userId, content);

    // Increment unread for other participants
    const otherParticipants = conversation.participants
      .filter((p) => p.user.toString() !== userId)
      .map((p) => p.user);

    for (const participantId of otherParticipants) {
      await Conversation.incrementUnread(conversationId, participantId);
    }

    // Broadcast via WebSocket so real-time clients pick it up
    emitToConversation(conversationId, 'new_message', {
      message: populatedMessage,
      conversationId
    });

    // Notify offline participants
    for (const participantId of otherParticipants) {
      emitToUser(participantId.toString(), 'notification', {
        type: 'new_message',
        conversationId,
        preview: content.substring(0, 80),
        senderName: req.user.name || req.user.email,
        sentAt: message.createdAt
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent',
      data: { message: populatedMessage }
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// =============================================================================
// MARK AS READ
// =============================================================================

/**
 * @desc    Mark all messages in a conversation as read
 * @route   PATCH /api/chat/conversations/:id/read
 * @access  Authenticated (participant only)
 */
const markAsRead = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;

    // Verify participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const [readResult] = await Promise.all([
      Message.markMessagesAsRead(conversationId, userId),
      Conversation.markAsRead(conversationId, userId)
    ]);

    // Notify other participants via WebSocket
    emitToConversation(conversationId, 'messages_read', {
      conversationId,
      readBy: { userId, readAt: new Date() },
      count: readResult.modifiedCount
    });

    return res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      data: { modifiedCount: readResult.modifiedCount }
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
};

// =============================================================================
// UNREAD COUNT
// =============================================================================

/**
 * @desc    Get total unread message count across all conversations
 * @route   GET /api/chat/unread-count
 * @access  Authenticated
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      'participants.user': userId,
      status: 'active'
    }).lean();

    let totalUnread = 0;
    for (const convo of conversations) {
      const participant = convo.participants.find(
        (p) => p.user.toString() === userId
      );
      if (participant) {
        totalUnread += participant.unreadCount || 0;
      }
    }

    return res.status(200).json({
      success: true,
      data: { unreadCount: totalUnread }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
};

module.exports = {
  startConversation,
  getConversations,
  getConversation,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount
};
