/**
 * =============================================================================
 * WEBSOCKET SERVICE (Socket.IO)
 * =============================================================================
 * Real-time bidirectional communication layer for the chat module
 *
 * Features:
 * - JWT-based authentication on connection
 * - Room-based messaging (one room per conversation)
 * - Typing indicators (start/stop) with auto-timeout
 * - Message delivery & read receipts
 * - Online presence tracking
 * - Automatic reconnection support (client-side)
 * - Graceful error handling and disconnect cleanup
 * - Redis pub/sub adapter ready (for horizontal scaling)
 *
 * Events (Client → Server):
 *   join_conversation   - Join a conversation room
 *   leave_conversation  - Leave a conversation room
 *   send_message        - Send a chat message
 *   typing_start        - User started typing
 *   typing_stop         - User stopped typing
 *   mark_read           - Mark messages as read
 *   get_online_users    - Request online user list
 *
 * Events (Server → Client):
 *   new_message         - New message received
 *   message_sent        - Confirmation of sent message
 *   typing_indicator    - Someone is typing / stopped
 *   messages_read       - Messages marked as read
 *   user_online         - A user came online
 *   user_offline        - A user went offline
 *   online_users        - Full list of online users
 *   conversation_closed - Conversation closed by staff
 *   error               - Error notification
 *
 * Usage:
 *   const { initializeWebSocket } = require('./config/websocket');
 *   const io = initializeWebSocket(httpServer);
 * =============================================================================
 */

const { Server } = require('socket.io');
const { verifyToken } = require('../utils/tokenGenerator');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// =============================================================================
// STATE
// =============================================================================

/** @type {Server} Socket.IO server instance */
let io = null;

/**
 * Map of userId → Set<socketId>
 * Tracks which sockets belong to each authenticated user.
 * A user may have multiple tabs/devices.
 */
const onlineUsers = new Map();

/**
 * Map of `${conversationId}:${userId}` → timeoutId
 * Auto-clears typing indicator after 5 seconds of inactivity
 */
const typingTimeouts = new Map();

/** Typing timeout duration in ms */
const TYPING_TIMEOUT_MS = 5000;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * @desc    Initialize Socket.IO server and attach to HTTP server
 * @param   {http.Server} httpServer - Node.js HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
const initializeWebSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        'https://takra-admin.vercel.app',
        'https://takra-frontend.vercel.app',
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:5173'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6 // 1 MB max message size
  });

  // ─── Authentication Middleware ───────────────────────────────────────
  io.use(authenticateSocket);

  // ─── Connection Handler ─────────────────────────────────────────────
  io.on('connection', handleConnection);

  console.log('✓ WebSocket server initialized');
  return io;
};

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * @desc    Authenticate socket connection using JWT
 * @param   {Socket} socket - Socket.IO socket instance
 * @param   {Function} next - Next middleware function
 */
const authenticateSocket = (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required. Provide a valid JWT token.'));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid or expired token.'));
    }

    // Attach user data to socket
    socket.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name || decoded.email
    };

    next();
  } catch (error) {
    console.error('Socket auth error:', error.message);
    next(new Error('Authentication failed.'));
  }
};

// =============================================================================
// CONNECTION HANDLER
// =============================================================================

/**
 * @desc    Handle new socket connection and register event listeners
 * @param   {Socket} socket - Authenticated socket instance
 */
const handleConnection = (socket) => {
  const { id: userId, name, role } = socket.user;

  console.log(`⚡ Socket connected: ${name} (${role}) [${socket.id}]`);

  // ─── Track Online Presence ────────────────────────────────────────
  addOnlineUser(userId, socket.id);
  broadcastPresence(userId, true);

  // ─── Register Event Handlers ──────────────────────────────────────
  socket.on('join_conversation', (data) => handleJoinConversation(socket, data));
  socket.on('leave_conversation', (data) => handleLeaveConversation(socket, data));
  socket.on('send_message', (data) => handleSendMessage(socket, data));
  socket.on('typing_start', (data) => handleTypingStart(socket, data));
  socket.on('typing_stop', (data) => handleTypingStop(socket, data));
  socket.on('mark_read', (data) => handleMarkRead(socket, data));
  socket.on('get_online_users', () => handleGetOnlineUsers(socket));
  socket.on('disconnect', (reason) => handleDisconnect(socket, reason));
  socket.on('error', (error) => {
    console.error(`Socket error [${socket.id}]:`, error.message);
  });
};

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * @desc    Join a conversation room
 * @param   {Socket} socket
 * @param   {{ conversationId: string }} data
 */
const handleJoinConversation = async (socket, data) => {
  try {
    const { conversationId } = data || {};
    if (!conversationId) {
      return socket.emit('error', { message: 'conversationId is required' });
    }

    // Verify participant access
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': socket.user.id
    });

    if (!conversation) {
      return socket.emit('error', { message: 'Conversation not found or access denied' });
    }

    // Join the Socket.IO room
    socket.join(`conversation:${conversationId}`);

    // Mark messages as read on join
    await Promise.all([
      Message.markMessagesAsRead(conversationId, socket.user.id),
      Conversation.markAsRead(conversationId, socket.user.id)
    ]);

    socket.emit('joined_conversation', {
      conversationId,
      message: 'Joined conversation successfully'
    });

    console.log(`📥 ${socket.user.name} joined conversation ${conversationId}`);
  } catch (error) {
    console.error('Join conversation error:', error.message);
    socket.emit('error', { message: 'Failed to join conversation' });
  }
};

/**
 * @desc    Leave a conversation room
 * @param   {Socket} socket
 * @param   {{ conversationId: string }} data
 */
const handleLeaveConversation = (socket, data) => {
  try {
    const { conversationId } = data || {};
    if (!conversationId) return;

    socket.leave(`conversation:${conversationId}`);
    clearTypingTimeout(conversationId, socket.user.id);

    console.log(`📤 ${socket.user.name} left conversation ${conversationId}`);
  } catch (error) {
    console.error('Leave conversation error:', error.message);
  }
};

/**
 * @desc    Handle incoming message, persist to DB, and broadcast to room
 * @param   {Socket} socket
 * @param   {{ conversationId: string, content: string, type?: string, metadata?: object }} data
 */
const handleSendMessage = async (socket, data) => {
  try {
    const { conversationId, content, type = 'text', metadata = {} } = data || {};

    // ─── Validation ───────────────────────────────────────────────────
    if (!conversationId || !content) {
      return socket.emit('error', { message: 'conversationId and content are required' });
    }

    if (content.length > 2000) {
      return socket.emit('error', { message: 'Message cannot exceed 2000 characters' });
    }

    // Verify participant access
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': socket.user.id,
      status: 'active'
    });

    if (!conversation) {
      return socket.emit('error', {
        message: 'Conversation not found, closed, or access denied'
      });
    }

    // ─── Persist Message ──────────────────────────────────────────────
    const message = await Message.create({
      conversation: conversationId,
      sender: socket.user.id,
      content: content.trim(),
      type,
      metadata,
      readBy: [{ user: socket.user.id, readAt: new Date() }]
    });

    // Populate sender info for broadcast
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email role avatar')
      .lean();

    // ─── Update Conversation Metadata ─────────────────────────────────
    // Update last message + increment unread for other participants
    const otherParticipants = conversation.participants
      .filter((p) => p.user.toString() !== socket.user.id)
      .map((p) => p.user);

    await Conversation.updateLastMessage(conversationId, socket.user.id, content);

    // Increment unread for each other participant
    for (const participantId of otherParticipants) {
      await Conversation.incrementUnread(conversationId, participantId);
    }

    // ─── Clear Typing Indicator ───────────────────────────────────────
    clearTypingTimeout(conversationId, socket.user.id);
    io.to(`conversation:${conversationId}`).emit('typing_indicator', {
      conversationId,
      userId: socket.user.id,
      userName: socket.user.name,
      isTyping: false
    });

    // ─── Broadcast Message ────────────────────────────────────────────
    // Send to all participants in the room
    io.to(`conversation:${conversationId}`).emit('new_message', {
      message: populatedMessage,
      conversationId
    });

    // Confirm to sender
    socket.emit('message_sent', {
      messageId: message._id,
      conversationId,
      sentAt: message.createdAt
    });

    // ─── Notify Offline Participants ──────────────────────────────────
    for (const participantId of otherParticipants) {
      const participantIdStr = participantId.toString();
      if (!onlineUsers.has(participantIdStr)) {
        // Participant is offline — could push a notification here
        // For now, the unread count is already incremented
      } else {
        // Participant is online but may not be in the room
        const sockets = onlineUsers.get(participantIdStr);
        for (const socketId of sockets) {
          io.to(socketId).emit('notification', {
            type: 'new_message',
            conversationId,
            preview: content.substring(0, 80),
            senderName: socket.user.name,
            sentAt: message.createdAt
          });
        }
      }
    }
  } catch (error) {
    console.error('Send message error:', error.message);
    socket.emit('error', { message: 'Failed to send message' });
  }
};

/**
 * @desc    Handle typing start event with auto-timeout
 * @param   {Socket} socket
 * @param   {{ conversationId: string }} data
 */
const handleTypingStart = (socket, data) => {
  try {
    const { conversationId } = data || {};
    if (!conversationId) return;

    const key = `${conversationId}:${socket.user.id}`;

    // Broadcast typing indicator to other participants
    socket.to(`conversation:${conversationId}`).emit('typing_indicator', {
      conversationId,
      userId: socket.user.id,
      userName: socket.user.name,
      isTyping: true
    });

    // Clear existing timeout and set new one
    clearTypingTimeout(conversationId, socket.user.id);

    const timeoutId = setTimeout(() => {
      socket.to(`conversation:${conversationId}`).emit('typing_indicator', {
        conversationId,
        userId: socket.user.id,
        userName: socket.user.name,
        isTyping: false
      });
      typingTimeouts.delete(key);
    }, TYPING_TIMEOUT_MS);

    typingTimeouts.set(key, timeoutId);
  } catch (error) {
    console.error('Typing start error:', error.message);
  }
};

/**
 * @desc    Handle explicit typing stop event
 * @param   {Socket} socket
 * @param   {{ conversationId: string }} data
 */
const handleTypingStop = (socket, data) => {
  try {
    const { conversationId } = data || {};
    if (!conversationId) return;

    clearTypingTimeout(conversationId, socket.user.id);

    socket.to(`conversation:${conversationId}`).emit('typing_indicator', {
      conversationId,
      userId: socket.user.id,
      userName: socket.user.name,
      isTyping: false
    });
  } catch (error) {
    console.error('Typing stop error:', error.message);
  }
};

/**
 * @desc    Mark messages as read in a conversation
 * @param   {Socket} socket
 * @param   {{ conversationId: string }} data
 */
const handleMarkRead = async (socket, data) => {
  try {
    const { conversationId } = data || {};
    if (!conversationId) return;

    const [readResult] = await Promise.all([
      Message.markMessagesAsRead(conversationId, socket.user.id),
      Conversation.markAsRead(conversationId, socket.user.id)
    ]);

    // Notify other participants that messages were read
    socket.to(`conversation:${conversationId}`).emit('messages_read', {
      conversationId,
      readBy: {
        userId: socket.user.id,
        userName: socket.user.name,
        readAt: new Date()
      },
      count: readResult.modifiedCount
    });
  } catch (error) {
    console.error('Mark read error:', error.message);
  }
};

/**
 * @desc    Send list of online users to the requesting socket
 * @param   {Socket} socket
 */
const handleGetOnlineUsers = (socket) => {
  try {
    const users = [];
    for (const [userId] of onlineUsers) {
      users.push(userId);
    }
    socket.emit('online_users', { users });
  } catch (error) {
    console.error('Get online users error:', error.message);
  }
};

/**
 * @desc    Handle socket disconnection and clean up resources
 * @param   {Socket} socket
 * @param   {string} reason - Disconnect reason
 */
const handleDisconnect = (socket, reason) => {
  const { id: userId, name } = socket.user;

  console.log(`⚡ Socket disconnected: ${name} [${socket.id}] (${reason})`);

  // Remove socket from user's socket set
  removeOnlineUser(userId, socket.id);

  // Clear all typing timeouts for this user
  for (const [key, timeoutId] of typingTimeouts) {
    if (key.endsWith(`:${userId}`)) {
      clearTimeout(timeoutId);
      typingTimeouts.delete(key);

      const conversationId = key.split(':')[0];
      io.to(`conversation:${conversationId}`).emit('typing_indicator', {
        conversationId,
        userId,
        userName: name,
        isTyping: false
      });
    }
  }

  // If user has no more active sockets, broadcast offline
  if (!onlineUsers.has(userId)) {
    broadcastPresence(userId, false);
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * @desc    Track a user's socket connection
 * @param   {string} userId
 * @param   {string} socketId
 */
const addOnlineUser = (userId, socketId) => {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
};

/**
 * @desc    Remove a user's socket connection
 * @param   {string} userId
 * @param   {string} socketId
 */
const removeOnlineUser = (userId, socketId) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
  }
};

/**
 * @desc    Broadcast user online/offline status to all connected clients
 * @param   {string}  userId
 * @param   {boolean} isOnline
 */
const broadcastPresence = (userId, isOnline) => {
  if (!io) return;
  io.emit(isOnline ? 'user_online' : 'user_offline', { userId });
};

/**
 * @desc    Clear typing auto-timeout for a user in a conversation
 * @param   {string} conversationId
 * @param   {string} userId
 */
const clearTypingTimeout = (conversationId, userId) => {
  const key = `${conversationId}:${userId}`;
  if (typingTimeouts.has(key)) {
    clearTimeout(typingTimeouts.get(key));
    typingTimeouts.delete(key);
  }
};

// =============================================================================
// PUBLIC API (for use from REST controllers)
// =============================================================================

/**
 * @desc    Emit an event to a specific user (all their sockets)
 * @param   {string} userId - Target user ID
 * @param   {string} event  - Event name
 * @param   {any}    data   - Event payload
 */
const emitToUser = (userId, event, data) => {
  if (!io) return;
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit(event, data);
    }
  }
};

/**
 * @desc    Emit an event to a conversation room
 * @param   {string} conversationId - Conversation ID
 * @param   {string} event          - Event name
 * @param   {any}    data           - Event payload
 */
const emitToConversation = (conversationId, event, data) => {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, data);
};

/**
 * @desc    Check if a user is currently online
 * @param   {string} userId
 * @returns {boolean}
 */
const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

/**
 * @desc    Get the Socket.IO server instance
 * @returns {Server|null}
 */
const getIO = () => io;

module.exports = {
  initializeWebSocket,
  emitToUser,
  emitToConversation,
  isUserOnline,
  getIO
};
