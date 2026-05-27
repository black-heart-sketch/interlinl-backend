const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ override: true });
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const EventEmitter = require('events');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { exec } = require('child_process');

// Import internal modules
const routes = require('./routes/index');
const socket = require('./socket');
const cronJobs = require('./cronJobs');
const { isAuth, roleCheck } = require('./middleware/auth');
const logEvent = require('./middleware/eventLogger');
const { uploadSingle, uploadMultiple } = require('./middleware/multer');

// Models
const User = require('./models/User');
const translationService = require('./services/translationService');

const dbEventEmitter = new EventEmitter();

// Configuration
const CONFIG = {
  db: {
    INITIAL_RETRY_DELAY: 1000,
    MAX_RETRY_DELAY: 60000,
    RETRY_MULTIPLIER: 1.5,
    HEALTH_CHECK_INTERVAL: 30000,
    MAX_RETRY_COUNT: 5,
  },
  cors: {
    origins: [
      'http://localhost:3000', 
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://127.0.0.1:3000', 
      'http://127.0.0.1:3001', 
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://52.47.210.204'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  server: {
    PORT: process.env.PORT || 5000,
  },
  jwt: {
    SECRET_KEY: process.env.JWT_SECRET || 'your_secret_key',
  },
};

const featureFlags = {
  useDatabaseFeatures: false
};

const connectionState = {
  currentRetryDelay: CONFIG.db.INITIAL_RETRY_DELAY,
  isConnected: false,
  retryCount: 0,
  status: 'disconnected'
};

const app = express();
const server = http.createServer(app);
const io = socket.init(server);

// Database Manager
class DatabaseManager {
  static listenersRegistered = false;
  static healthCheckInterval = null;

  static async connect() {
    if (connectionState.status === 'connecting') return;
    if (mongoose.connection.readyState === 1) {
      await this.handleSuccessfulConnection();
      return;
    }

    connectionState.status = 'connecting';
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!uri) {
        console.error('MONGODB_URI is not defined in .env');
        connectionState.status = 'failed';
        return;
    }

    console.log('Attempting to connect to database...');

    while (!connectionState.isConnected && connectionState.retryCount < CONFIG.db.MAX_RETRY_COUNT) {
      try {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
        });
        await this.handleSuccessfulConnection();
        break;
      } catch (err) {
        await this.handleConnectionError(err);
      }
    }
  }

  static async handleSuccessfulConnection() {
    console.log('MongoDB connected successfully');
    connectionState.isConnected = true;
    connectionState.status = 'connected';
    connectionState.currentRetryDelay = CONFIG.db.INITIAL_RETRY_DELAY;
    connectionState.retryCount = 0;
    featureFlags.useDatabaseFeatures = true;
    dbEventEmitter.emit('db:connected');

    if (!this.listenersRegistered) {
      mongoose.connection.on('error', this.handleConnectionError.bind(this));
      mongoose.connection.on('disconnected', this.handleDisconnection.bind(this));
      this.listenersRegistered = true;
    }
  }

  static async handleConnectionError(err) {
    console.error('Database connection error:', err.message);
    connectionState.isConnected = false;
    connectionState.status = 'disconnected';
    featureFlags.useDatabaseFeatures = false;
    dbEventEmitter.emit('db:error', err);

    if (connectionState.retryCount < CONFIG.db.MAX_RETRY_COUNT) {
      connectionState.retryCount++;
      console.log(`Retrying connection... Attempt #${connectionState.retryCount} in ${connectionState.currentRetryDelay / 1000} seconds.`);
      await new Promise(resolve => setTimeout(resolve, connectionState.currentRetryDelay));
      connectionState.currentRetryDelay = Math.min(
        connectionState.currentRetryDelay * CONFIG.db.RETRY_MULTIPLIER,
        CONFIG.db.MAX_RETRY_DELAY
      );
      await this.connect();
    } else {
      console.log("Max retries reached. Stopping reconnection attempts.");
      connectionState.status = 'failed';
    }
  }

  static async handleDisconnection() {
    console.log('Database disconnected');
    connectionState.isConnected = false;
    connectionState.status = 'disconnected';
    featureFlags.useDatabaseFeatures = false;
    dbEventEmitter.emit('db:disconnected');
    if (connectionState.retryCount < CONFIG.db.MAX_RETRY_COUNT) await this.connect();
  }

  static startHealthCheck() {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      if (mongoose.connection.readyState !== 1) {
        dbEventEmitter.emit('db:unhealthy');
        await this.connect();
      }
    }, CONFIG.db.HEALTH_CHECK_INTERVAL);
  }
}

// App Configuration
class AppConfig {
  static initialize(app) {
    this.setupMiddleware(app);
    this.setupStaticFiles(app);
    this.setupRoutes(app);
  }

  static setupMiddleware(app) {
    app.use(helmet({
      crossOriginResourcePolicy: false,
    }));
    
    // Rate Limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // limit each IP to 500 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);

    app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) return callback(null, true);
        
        // Check if origin is explicitly allowed or fits local development pattern (localhost or 127.0.0.1 on any port)
        if (
          CONFIG.cors.origins.includes(origin) ||
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true);
        }
        
        return callback(new Error('Not allowed by CORS'), false);
      },
      methods: CONFIG.cors.methods,
      allowedHeaders: CONFIG.cors.allowedHeaders,
      credentials: true,
    }));
    app.use(express.json({ limit: '50mb' }));
    
    // Global Event Logger Integration
    app.use(logEvent);
  }

  static setupStaticFiles(app) {
    const assetsPath = path.join(__dirname, '../assets');
    
    app.use(express.static(path.join(__dirname, 'views')));
    
    app.use('/users', express.static(path.join(assetsPath, 'images/users')));
    app.use('/research', express.static(path.join(assetsPath, 'images/research/thumbnail')));
    app.use('/research-docs', express.static(path.join(assetsPath, 'documents/research')));
    app.use('/courses/images', express.static(path.join(assetsPath, 'images/courses/thumbnails')));
    app.use('/courses/docs', express.static(path.join(assetsPath, 'documents/courses/thumbnails')));
    app.use('/course/images', express.static(path.join(assetsPath, 'images/courses/thumbnails')));
    app.use('/course/doc', express.static(path.join(assetsPath, 'documents/courses/thumbnails')));
    // General /assets route so stored paths like /assets/images/... resolve correctly
    app.use('/assets', express.static(assetsPath));
    app.use('/reports', isAuth, express.static(path.join(assetsPath, 'documents/reports')));
    app.use('/media', express.static(path.join(assetsPath, 'images/media')));
    app.use('/events', express.static(path.join(assetsPath, 'images/events')));
    app.use('/library', isAuth, express.static(path.join(assetsPath, 'library')));
    app.use('/receipts', isAuth, roleCheck(['superadmin', 'admin']), express.static(path.join(assetsPath, 'receipts')));
    
  }

  static setupRoutes(app) {
    app.use(async (req, res, next) => {
      if (req.path.startsWith('/api/') && !featureFlags.useDatabaseFeatures) {
        if (connectionState.status === 'disconnected') {
          await DatabaseManager.connect();
        }
        if (!featureFlags.useDatabaseFeatures) {
          return res.status(503).json({ 
            error: 'Database services temporarily unavailable.' 
          });
        }
      }
      next();
    });

    app.get('/api/verify-email', this.handleEmailVerification);
    app.get('/api/validate-token', this.validateToken);
    app.use('/api', routes);
    
    app.get('/health', (req, res) => {
      res.json({
        server: 'up',
        database: connectionState.status,
        retryAttempts: connectionState.retryCount
      });
    });

    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'views', 'index.html'));
    });
  }

  static async handleEmailVerification(req, res) {
    const { token } = req.query;
    try {
      const user = await User.findOne({ verificationToken: token });
      if (!user) return res.status(400).json({ error: 'Invalid token' });
      
      user.isVerified = true;
      user.verificationToken = undefined;
      await user.save();
      res.status(200).json({ message: 'Email verified successfully.' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }

  static validateToken(req, res) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, CONFIG.jwt.SECRET_KEY, (err, user) => {
      if (err) return res.status(403).json({ message: 'Invalid token' });
      return res.status(200).json({ user });
    });
  }
}

// Start Application
async function startApplication() {
  console.log('🚀 Initializing InterLink API...');

  
  console.log('🐳 Checking LiveKit Setup...');
  exec('bash setup_livekit.sh', (error, stdout, stderr) => {
      if (error) {
          console.warn(`⚠️ LiveKit Setup Warning (Make sure Docker is running): ${error.message}`);
          return;
      }
      if (stdout) console.log(stdout);
  });
  
  try {
    console.log('Connecting to Redis...');
    try {
      await translationService.connectRedis();
    } catch (redisErr) {
      console.warn('⚠️ Could not connect to Redis, proceeding without Redis cache:', redisErr.message);
    }
    
    AppConfig.initialize(app);
    
    server.listen(CONFIG.server.PORT, '0.0.0.0', () => {
      console.log(`📡 Server running on port ${CONFIG.server.PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${CONFIG.server.PORT} is already in use. Retrying in 2s...`);
        setTimeout(() => {
          server.close();
          server.listen(CONFIG.server.PORT);
        }, 2000);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
    
    const activeRooms = {}; // Format: { roomId: { userId: { username, avatar } } }

    io.on('connection', (socketClient) => {
        console.log('🔌 Client connected:', socketClient.id);
        socketClient.emit('database_status', { connected: featureFlags.useDatabaseFeatures });
        
        socketClient.on('join_room', ({ roomId, userId, username, avatar }) => {
            socketClient.join(roomId);
            if (userId) socketClient.join(`user:${userId}`);
            socketClient.roomId = roomId;
            socketClient.userId = userId;
            
            if (!activeRooms[roomId]) activeRooms[roomId] = {};
            activeRooms[roomId][userId] = { userId, username, avatar, socketId: socketClient.id };
            
            io.to(roomId).emit('room_users', Object.values(activeRooms[roomId]));
        });

        socketClient.on('identify_user', ({ userId }) => {
            if (!userId) return;
            socketClient.userId = userId;
            socketClient.join(`user:${userId}`);
        });

        socketClient.on('typing', ({ receiverId, senderId }) => {
            if (receiverId) socketClient.to(`user:${receiverId}`).emit('message:typing', { senderId });
        });

        socketClient.on('send_msg', ({ roomId, sender, text }) => {
            socketClient.to(roomId).emit('receive_msg', { sender, text, timestamp: new Date() });
        });

        socketClient.on('broadcast_alert', ({ roomId, alertText, sender }) => {
            socketClient.to(roomId).emit('receive_broadcast', { sender, text: alertText, timestamp: new Date() });
        });

        socketClient.on('start_video_course', ({ roomId, videoUrl, courseTitle, sender }) => {
            io.to(roomId).emit('video_course_started', { videoUrl, courseTitle, sender, timestamp: new Date() });
        });

        socketClient.on('sync_video_state', ({ roomId, action, time }) => {
            socketClient.to(roomId).emit('video_state_synced', { action, time });
        });

        socketClient.on('end_video_course', ({ roomId }) => {
            io.to(roomId).emit('video_course_ended');
        });

        // WebRTC Real-Time Video Chat Signaling Events
        socketClient.on('join_video_call', ({ roomId, userId, username, avatar }) => {
            console.log(`📹 User ${username} joined video call in room ${roomId}. Socket ID: ${socketClient.id}`);
            socketClient.to(roomId).emit('user_joined_video_call', {
                socketId: socketClient.id,
                userId,
                username,
                avatar
            });
        });

        socketClient.on('webrtc_signal', ({ targetSocketId, signalData }) => {
            socketClient.to(targetSocketId).emit('webrtc_signal', {
                senderSocketId: socketClient.id,
                signalData
            });
        });

        socketClient.on('leave_video_call', ({ roomId }) => {
            console.log(`📹 User left video call. Socket ID: ${socketClient.id}`);
            socketClient.to(roomId).emit('user_left_video_call', {
                socketId: socketClient.id
            });
        });

        socketClient.on('terminate_video_call', ({ roomId }) => {
            console.log(`📹 Host terminated video call in room ${roomId}. Socket ID: ${socketClient.id}`);
            io.to(roomId).emit('video_call_terminated_by_host');
        });

        socketClient.on('screen_share_started', ({ roomId }) => {
            socketClient.to(roomId).emit('peer_screen_share_started', { socketId: socketClient.id });
        });

        socketClient.on('screen_share_stopped', ({ roomId }) => {
            socketClient.to(roomId).emit('peer_screen_share_stopped', { socketId: socketClient.id });
        });

        socketClient.on('joinUploadRoom', (uploadJobId) => {
            socketClient.join(uploadJobId);
            console.log(`Socket ${socketClient.id} joined room ${uploadJobId}`);
        });

        socketClient.on('leaveUploadRoom', (uploadJobId) => {
            socketClient.leave(uploadJobId);
            console.log(`Socket ${socketClient.id} left room ${uploadJobId}`);
        });

        socketClient.on('disconnect', () => {
            console.log('🔌 Client disconnected:', socketClient.id);
            const { roomId, userId } = socketClient;
            if (roomId && userId && activeRooms[roomId]) {
                delete activeRooms[roomId][userId];
                io.to(roomId).emit('room_users', Object.values(activeRooms[roomId]));
            }
            if (roomId) {
                socketClient.to(roomId).emit('user_left_video_call', {
                    socketId: socketClient.id
                });
            }
        });
    });

    DatabaseManager.connect().then(() => {
      if (cronJobs && typeof cronJobs.startJobs === 'function') {
        cronJobs.startJobs();
      }
      DatabaseManager.startHealthCheck();

      // Initialize dynamic database translation pre-caching in the background
      translationService.warmupAll().catch(err => {
        console.error('⚠️ Failed to warm up translation cache on startup:', err.message);
      });
    });

  } catch (err) {
    console.error('❌ Failed to start application:', err);
  }
}

// Graceful Shutdown
process.on('SIGINT', async () => {
  try {
    if (mongoose.connection.readyState === 1) await mongoose.connection.close();
    server.close(() => process.exit(0));
  } catch (err) {
    process.exit(1);
  }
});

startApplication();

module.exports = { app, server };
