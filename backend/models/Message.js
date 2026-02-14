/**
 * =============================================================================
 * MESSAGE SCHEMA MODEL
 * =============================================================================
 * Mongoose schema for individual chat messages within conversations
 *
 * Features:
 * - Belongs to a Conversation via conversationId
 * - Supports text, image, and system message types
 * - Delivery status tracking (sent, delivered, read)
 * - Soft delete support
 * - Automatic timestamps (createdAt, updatedAt)
 *
 * Static Methods:
 *   getMessagesByConversation(conversationId, options) - Paginated messages
 *   markMessagesAsRead(conversationId, userId)         - Bulk mark as read
 *
 * Usage:
 *   const Message = require('./models/Message');
 *   const msg = await Message.create({ conversation, sender, content });
 * =============================================================================
 */

const mongoose = require('mongoose');

/**
 * Message Schema Definition
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required']
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
      trim: true
    },
    type: {
      type: String,
      enum: {
        values: ['text', 'image', 'system'],
        message: '{VALUE} is not a valid message type'
      },
      default: 'text'
    },
    status: {
      type: String,
      enum: {
        values: ['sent', 'delivered', 'read'],
        message: '{VALUE} is not a valid message status'
      },
      default: 'sent'
    },
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now }
      }
    ],
    metadata: {
      imageUrl: { type: String, default: null },
      thumbnailUrl: { type: String, default: null },
      fileSize: { type: Number, default: null }
    },
    isDeleted: {
      type: Boolean,
      default: false
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

// Fast lookup for messages in a conversation sorted by time
messageSchema.index({ conversation: 1, createdAt: -1 });
// Filter out deleted messages
messageSchema.index({ conversation: 1, isDeleted: 1, createdAt: -1 });

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * @desc    Get paginated messages for a conversation (newest first)
 * @param   {ObjectId} conversationId - Conversation ID
 * @param   {Object}   options        - { page, limit, before }
 * @returns {Promise<{ messages: Document[], total: number, hasMore: boolean }>}
 */
messageSchema.statics.getMessagesByConversation = async function (
  conversationId,
  { page = 1, limit = 50, before = null } = {}
) {
  const filter = {
    conversation: conversationId,
    isDeleted: false
  };

  // Cursor-based pagination: get messages before a specific timestamp
  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const skip = before ? 0 : (page - 1) * limit;

  const [messages, total] = await Promise.all([
    this.find(filter)
      .populate('sender', 'name email role avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1) // Fetch one extra to detect hasMore
      .lean(),
    this.countDocuments({ conversation: conversationId, isDeleted: false })
  ]);

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop(); // Remove the extra document

  return {
    messages: messages.reverse(), // Return in chronological order
    total,
    hasMore
  };
};

/**
 * @desc    Mark all messages in a conversation as read by a specific user
 * @param   {ObjectId} conversationId - Conversation ID
 * @param   {ObjectId} userId         - User marking as read
 * @returns {Promise<{ modifiedCount: number }>}
 */
messageSchema.statics.markMessagesAsRead = async function (conversationId, userId) {
  const result = await this.updateMany(
    {
      conversation: conversationId,
      sender: { $ne: userId },
      isDeleted: false,
      'readBy.user': { $ne: userId }
    },
    {
      $push: { readBy: { user: userId, readAt: new Date() } },
      $set: { status: 'read' }
    }
  );

  return { modifiedCount: result.modifiedCount };
};

/**
 * @desc    Soft delete a message
 * @param   {ObjectId} messageId - Message ID
 * @param   {ObjectId} userId    - User requesting deletion (must be sender)
 * @returns {Promise<Document|null>}
 */
messageSchema.statics.softDelete = async function (messageId, userId) {
  return this.findOneAndUpdate(
    { _id: messageId, sender: userId },
    { isDeleted: true, content: 'This message was deleted' },
    { new: true }
  );
};

module.exports = mongoose.model('Message', messageSchema);
