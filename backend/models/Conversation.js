/**
 * =============================================================================
 * CONVERSATION SCHEMA MODEL
 * =============================================================================
 * Mongoose schema for chat conversations between users and support/admin
 *
 * Features:
 * - Tracks participants (user + support/admin)
 * - Conversation status management (active, closed, archived)
 * - Last message preview for listing views
 * - Unread count per participant
 * - Typing indicator tracking
 * - Automatic timestamps (createdAt, updatedAt)
 *
 * Static Methods:
 *   findOrCreateConversation(userId, staffId)  - Get or start conversation
 *   getConversationsForUser(userId)             - List user's conversations
 *   getConversationsForStaff(staffId)           - List staff's conversations
 *
 * Usage:
 *   const Conversation = require('./models/Conversation');
 *   const convo = await Conversation.findOrCreateConversation(userId, staffId);
 * =============================================================================
 */

const mongoose = require('mongoose');

/**
 * Participant sub-schema
 * Tracks per-user metadata within a conversation
 */
const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastReadAt: {
      type: Date,
      default: Date.now
    },
    isTyping: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

/**
 * Conversation Schema Definition
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [participantSchema],
      validate: {
        validator: (v) => v.length >= 2,
        message: 'A conversation requires at least 2 participants'
      }
    },
    type: {
      type: String,
      enum: {
        values: ['support', 'admin', 'general'],
        message: '{VALUE} is not a valid conversation type'
      },
      default: 'support'
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'closed', 'archived'],
        message: '{VALUE} is not a valid conversation status'
      },
      default: 'active'
    },
    subject: {
      type: String,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
      trim: true,
      default: 'Support Request'
    },
    lastMessage: {
      content: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      sentAt: { type: Date, default: Date.now }
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// =============================================================================
// INDEXES
// =============================================================================

// Fast lookup for user's conversations
conversationSchema.index({ 'participants.user': 1, updatedAt: -1 });
// Filter by status
conversationSchema.index({ status: 1 });
// Compound: status + updated for listing
conversationSchema.index({ status: 1, updatedAt: -1 });

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * @desc    Find existing conversation between two users, or create a new one
 * @param   {ObjectId} userId   - The initiating user
 * @param   {ObjectId} staffId  - The support/admin staff member
 * @param   {string}   type     - Conversation type ('support' | 'admin')
 * @param   {string}   subject  - Conversation subject
 * @returns {Promise<Document>} The conversation document
 */
conversationSchema.statics.findOrCreateConversation = async function (
  userId,
  staffId,
  type = 'support',
  subject = 'Support Request'
) {
  // Look for an existing active conversation between these two users
  let conversation = await this.findOne({
    'participants.user': { $all: [userId, staffId] },
    status: 'active'
  }).populate('participants.user', 'name email role avatar');

  if (conversation) return conversation;

  // Create new conversation
  conversation = await this.create({
    participants: [
      { user: userId, unreadCount: 0, lastReadAt: new Date() },
      { user: staffId, unreadCount: 0, lastReadAt: new Date() }
    ],
    type,
    subject,
    lastMessage: {
      content: '',
      sender: userId,
      sentAt: new Date()
    }
  });

  return conversation.populate('participants.user', 'name email role avatar');
};

/**
 * @desc    Get all conversations for a specific user with pagination
 * @param   {ObjectId} userId  - User ID
 * @param   {Object}   options - { page, limit, status }
 * @returns {Promise<{ conversations: Document[], total: number }>}
 */
conversationSchema.statics.getConversationsForUser = async function (
  userId,
  { page = 1, limit = 20, status = null } = {}
) {
  const filter = { 'participants.user': userId };
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [conversations, total] = await Promise.all([
    this.find(filter)
      .populate('participants.user', 'name email role avatar')
      .populate('lastMessage.sender', 'name')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filter)
  ]);

  return { conversations, total };
};

/**
 * @desc    Update the last message preview on a conversation
 * @param   {ObjectId} conversationId - Conversation ID
 * @param   {ObjectId} senderId       - Sender user ID
 * @param   {string}   content        - Message content preview
 * @returns {Promise<Document>}
 */
conversationSchema.statics.updateLastMessage = async function (
  conversationId,
  senderId,
  content
) {
  return this.findByIdAndUpdate(
    conversationId,
    {
      lastMessage: {
        content: content.substring(0, 100), // Preview truncated to 100 chars
        sender: senderId,
        sentAt: new Date()
      }
    },
    { new: true }
  );
};

/**
 * @desc    Increment unread count for a participant
 * @param   {ObjectId} conversationId - Conversation ID
 * @param   {ObjectId} userId         - User whose unread count to increment
 * @returns {Promise<Document>}
 */
conversationSchema.statics.incrementUnread = async function (conversationId, userId) {
  return this.findOneAndUpdate(
    { _id: conversationId, 'participants.user': userId },
    { $inc: { 'participants.$.unreadCount': 1 } },
    { new: true }
  );
};

/**
 * @desc    Reset unread count for a participant (mark as read)
 * @param   {ObjectId} conversationId - Conversation ID
 * @param   {ObjectId} userId         - User who read messages
 * @returns {Promise<Document>}
 */
conversationSchema.statics.markAsRead = async function (conversationId, userId) {
  return this.findOneAndUpdate(
    { _id: conversationId, 'participants.user': userId },
    {
      $set: {
        'participants.$.unreadCount': 0,
        'participants.$.lastReadAt': new Date()
      }
    },
    { new: true }
  );
};

/**
 * @desc    Close a conversation
 * @param   {ObjectId} conversationId - Conversation ID
 * @param   {ObjectId} closedByUserId - User who closed it
 * @returns {Promise<Document>}
 */
conversationSchema.statics.closeConversation = async function (conversationId, closedByUserId) {
  return this.findByIdAndUpdate(
    conversationId,
    {
      status: 'closed',
      closedBy: closedByUserId,
      closedAt: new Date()
    },
    { new: true }
  ).populate('participants.user', 'name email role');
};

module.exports = mongoose.model('Conversation', conversationSchema);
