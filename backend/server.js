/**
 * =============================================================================
 * SERVER ENTRY POINT
 * =============================================================================
 * Application bootstrap - initializes services and starts HTTP server
 * 
 * Startup Order:
 *   1. Initialize Redis cache connection
 *   2. Connect to MongoDB database
 *   3. Start Express HTTP server
 * 
 * Graceful Shutdown:
 *   - Handles SIGTERM signal
 *   - Closes Redis connection
 *   - Exits cleanly
 * 
 * Environment Variables:
 *   PORT     - HTTP server port (default: 5000)
 *   NODE_ENV - Environment mode (development/production)
 * =============================================================================
 */

const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/database');
const { initializeCache } = require('./config/cache');
const { initializeWebSocket } = require('./config/websocket');

const PORT = process.env.PORT || 5000;

/**
 * @desc    Initialize all services and start HTTP server
 * @returns {Promise<void>}
 */
const startServer = async () => {
  try {
    console.log('Starting server initialization...\n');

    // Step 1: Initialize cache (Redis)
    console.log('[1/3] Connecting to Redis cache...');
    await initializeCache();

    // Step 2: Connect to MongoDB
    console.log('[2/3] Connecting to MongoDB...');
    await connectDB();

    // Step 3: Create HTTP server & attach WebSocket
    console.log('[3/4] Creating HTTP server...');
    const server = http.createServer(app);

    // Step 4: Initialize WebSocket (Socket.IO)
    console.log('[4/4] Initializing WebSocket...');
    initializeWebSocket(server);

    // Start listening
    server.listen(PORT, () => {
      console.log('\n========================================');
      console.log(`✓ Server is running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ API: http://localhost:${PORT}/api`);
      console.log(`✓ WebSocket: ws://localhost:${PORT}`);
      console.log('========================================\n');
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 * Closes connections before process exit
 */
process.on('SIGTERM', async () => {
  console.log('\n✗ SIGTERM signal received: closing HTTP server');
  const { closeConnection } = require('./config/cache');
  await closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n✗ SIGINT signal received: closing HTTP server');
  const { closeConnection } = require('./config/cache');
  await closeConnection();
  process.exit(0);
});

// Start the server
startServer();

