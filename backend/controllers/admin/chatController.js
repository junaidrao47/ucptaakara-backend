/**
 * =============================================================================
 * ADMIN / SUPPORT CHAT CONTROLLER
 * =============================================================================
 * REST API endpoints for admin/support staff to manage chat conversations
 *
 * Endpoints:
 *   GET    /api/admin/chat/conversations            - List all conversations
 *   GET    /api/admin/chat/conversations/:id         - Get conversation details
 *   GET    /api/admin/chat/conversations/:id/messages - Get messages
 *   POST   /api/admin/chat/conversations/:id/messages - Reply to a conversation
 *   PATCH  /api/admin/chat/conversations/:id/close   - Close a conversation
 *   PATCH  /api/admin/chat/conversations/:id/reopen  - Reopen a conversation
 *   GET    /api/admin/chat/stats                     - Chat statistics
 *
 * Access: admin and support roles only.
 * =============================================================================
 */

const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const User = require('../../models/UserSchema');
const { emitToUser, emitToConversation, isUserOnline } = require('../../config/websocket');

// =============================================================================
// LIST ALL CONVERSATIONS (Admin View)
// =============================================================================

/**
 * @desc    List all conversations (optionally filtered by status)
 * @route   GET /api/admin/chat/conversations
 * @access  Admin, Support
 * @query   { page?, limit?, status?, search? }
 */
const getAllConversations = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;
    const { status, search } = req.query;

    const filter = {};
    if (status) filter.status = status;

    // Build aggregation pipeline for search support
    const pipeline = [{ $match: filter }];

    // Populate participants
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'participants.user',
          foreignField: '_id',
          as: 'participantDetails'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.sender',
          foreignField: '_id',
          as: 'lastMessageSender'
        }
      }
    );

    // Search filter on participant name/email or subject
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'participantDetails.name': { $regex: search, $options: 'i' } },
            { 'participantDetails.email': { $regex: search, $options: 'i' } },
            { subject: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Count total
    const countPipeline = [...pipeline, { $count: 'total' }];
    const [countResult] = await Conversation.aggregate(countPipeline);
    const total = countResult?.total || 0;

    // Sort, paginate, project
    pipeline.push(
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          type: 1,
          status: 1,
          subject: 1,
          participants: 1,
          participantDetails: {
            _id: 1,
            name: 1,
            email: 1,
            role: 1,
            avatar: 1
          },
          lastMessage: 1,
          lastMessageSender: { $arrayElemAt: ['$lastMessageSender', 0] },
          createdAt: 1,
          updatedAt: 1,
          closedAt: 1,
          closedBy: 1
        }
      }
    );

    const conversations = await Conversation.aggregate(pipeline);

    // Enrich with online status
    const enriched = conversations.map((convo) => ({
      ...convo,
      participantDetails: convo.participantDetails.map((p) => ({
        ...p,
        isOnline: isUserOnline(p._id.toString())
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
    console.error('Admin get conversations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
};

// =============================================================================
// GET CONVERSATION DETAIL
// =============================================================================

/**
 * @desc    Get a single conversation with participant details
 * @route   GET /api/admin/chat/conversations/:id
 * @access  Admin, Support
 */
const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants.user', 'name email role avatar')
      .populate('lastMessage.sender', 'name')
      .populate('closedBy', 'name email')
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
      isOnline: isUserOnline(p.user?._id?.toString())
    }));

    return res.status(200).json({
      success: true,
      data: { conversation }
    });
  } catch (error) {
    console.error('Admin get conversation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation'
    });
  }
};

// =============================================================================
// GET MESSAGES (Admin View)
// =============================================================================

/**
 * @desc    Get paginated messages for a conversation
 * @route   GET /api/admin/chat/conversations/:id/messages
 * @access  Admin, Support
 * @query   { page?, limit?, before? }
 */
const getMessages = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before || null;

    const conversation = await Conversation.findById(conversationId);
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
        pagination: { page, limit, total, hasMore }
      }
    });
  } catch (error) {
    console.error('Admin get messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

// =============================================================================
// REPLY TO CONVERSATION
// =============================================================================

/**
 * @desc    Admin/support sends a message in a conversation
 * @route   POST /api/admin/chat/conversations/:id/messages
 * @access  Admin, Support
 * @body    { content: string, type?: string }
 */
const replyToConversation = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const staffId = req.user.id;
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

    // Verify conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // If conversation is closed, auto-reopen on staff reply
    if (conversation.status === 'closed') {
      conversation.status = 'active';
      conversation.closedAt = null;
      conversation.closedBy = null;
      await conversation.save();
    }

    // Ensure staff is a participant (add them if not)
    const isParticipant = conversation.participants.some(
      (p) => p.user.toString() === staffId
    );

    if (!isParticipant) {
      conversation.participants.push({
        user: staffId,
        unreadCount: 0,
        lastReadAt: new Date()
      });
      await conversation.save();
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: staffId,
      content: content.trim(),
      type,
      readBy: [{ user: staffId, readAt: new Date() }]
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email role avatar')
      .lean();

    // Update conversation metadata
    await Conversation.updateLastMessage(conversationId, staffId, content);

    // Increment unread for other participants
    const otherParticipants = conversation.participants
      .filter((p) => p.user.toString() !== staffId)
      .map((p) => p.user);

    for (const participantId of otherParticipants) {
      await Conversation.incrementUnread(conversationId, participantId);
    }

    // Broadcast via WebSocket
    emitToConversation(conversationId, 'new_message', {
      message: populatedMessage,
      conversationId
    });

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
      message: 'Reply sent',
      data: { message: populatedMessage }
    });
  } catch (error) {
    console.error('Admin reply error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send reply'
    });
  }
};

// =============================================================================
// CLOSE CONVERSATION
// =============================================================================

/**
 * @desc    Close a conversation
 * @route   PATCH /api/admin/chat/conversations/:id/close
 * @access  Admin, Support
 */
const closeConversation = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const staffId = req.user.id;

    const conversation = await Conversation.closeConversation(conversationId, staffId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Send a system message
    const systemMessage = await Message.create({
      conversation: conversationId,
      sender: staffId,
      content: `Conversation closed by ${req.user.name || 'staff'}`,
      type: 'system',
      readBy: [{ user: staffId, readAt: new Date() }]
    });

    // Notify all participants via WebSocket
    emitToConversation(conversationId, 'conversation_closed', {
      conversationId,
      closedBy: { id: staffId, name: req.user.name },
      closedAt: conversation.closedAt,
      systemMessage: systemMessage.toObject()
    });

    return res.status(200).json({
      success: true,
      message: 'Conversation closed',
      data: { conversation }
    });
  } catch (error) {
    console.error('Close conversation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to close conversation'
    });
  }
};

// =============================================================================
// REOPEN CONVERSATION
// =============================================================================

/**
 * @desc    Reopen a previously closed conversation
 * @route   PATCH /api/admin/chat/conversations/:id/reopen
 * @access  Admin, Support
 */
const reopenConversation = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const staffId = req.user.id;

    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        status: 'active',
        closedBy: null,
        closedAt: null
      },
      { new: true }
    ).populate('participants.user', 'name email role');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // System message
    const systemMessage = await Message.create({
      conversation: conversationId,
      sender: staffId,
      content: `Conversation reopened by ${req.user.name || 'staff'}`,
      type: 'system',
      readBy: [{ user: staffId, readAt: new Date() }]
    });

    // Notify via WebSocket
    emitToConversation(conversationId, 'conversation_reopened', {
      conversationId,
      reopenedBy: { id: staffId, name: req.user.name },
      systemMessage: systemMessage.toObject()
    });

    return res.status(200).json({
      success: true,
      message: 'Conversation reopened',
      data: { conversation }
    });
  } catch (error) {
    console.error('Reopen conversation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reopen conversation'
    });
  }
};

// =============================================================================
// CHAT STATISTICS
// =============================================================================

/**
 * @desc    Get chat module statistics
 * @route   GET /api/admin/chat/stats
 * @access  Admin
 */
const getChatStats = async (req, res) => {
  try {
    const [
      totalConversations,
      activeConversations,
      closedConversations,
      totalMessages,
      todayMessages
    ] = await Promise.all([
      Conversation.countDocuments(),
      Conversation.countDocuments({ status: 'active' }),
      Conversation.countDocuments({ status: 'closed' }),
      Message.countDocuments({ isDeleted: false }),
      Message.countDocuments({
        isDeleted: false,
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      })
    ]);

    // Average response time (last 7 days) — time between user message and staff reply
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const responseTimePipeline = [
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          type: 'text',
          isDeleted: false
        }
      },
      { $sort: { conversation: 1, createdAt: 1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'sender',
          foreignField: '_id',
          as: 'senderInfo'
        }
      },
      { $unwind: '$senderInfo' },
      {
        $group: {
          _id: '$conversation',
          messages: {
            $push: {
              createdAt: '$createdAt',
              role: '$senderInfo.role'
            }
          }
        }
      }
    ];

    const conversationMessages = await Message.aggregate(responseTimePipeline);

    let totalResponseTime = 0;
    let responseCount = 0;

    for (const convo of conversationMessages) {
      const msgs = convo.messages;
      for (let i = 1; i < msgs.length; i++) {
        if (
          msgs[i - 1].role === 'user' &&
          (msgs[i].role === 'admin' || msgs[i].role === 'support')
        ) {
          totalResponseTime += msgs[i].createdAt - msgs[i - 1].createdAt;
          responseCount++;
        }
      }
    }

    const avgResponseTimeMs = responseCount > 0 ? totalResponseTime / responseCount : 0;
    const avgResponseMinutes = Math.round(avgResponseTimeMs / 60000);

    return res.status(200).json({
      success: true,
      data: {
        totalConversations,
        activeConversations,
        closedConversations,
        totalMessages,
        todayMessages,
        avgResponseMinutes
      }
    });
  } catch (error) {
    console.error('Chat stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch chat statistics'
    });
  }
};

module.exports = {
  getAllConversations,
  getConversation,
  getMessages,
  replyToConversation,
  closeConversation,
  reopenConversation,
  getChatStats
};
