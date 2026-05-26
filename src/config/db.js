const mongoose = require('mongoose');
const EventEmitter = require('events');

const dbEventEmitter = new EventEmitter();

const dbConfig = {
  INITIAL_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 60000,
  RETRY_MULTIPLIER: 1.5,
  HEALTH_CHECK_INTERVAL: 30000,
  MAX_RETRY_COUNT: 5
};

const featureFlags = {
  useDatabaseFeatures: false
};

const connectionState = {
  currentRetryDelay: dbConfig.INITIAL_RETRY_DELAY,
  isConnected: false,
  retryCount: 0,
  status: 'disconnected'
};

class DatabaseManager {
  static async connect() {
    if (connectionState.status === 'connecting') {
      console.log('Connection attempt already in progress');
      return;
    }

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri || mongoUri === 'your_mongodb_connection') {
      connectionState.status = 'failed';
      console.warn('MongoDB connection skipped: set MONGO_URI or MONGODB_URI in .env');
      return;
    }

    connectionState.status = 'connecting';
    console.log('Attempting to connect to database...');

    while (!connectionState.isConnected && connectionState.retryCount < dbConfig.MAX_RETRY_COUNT) {
      try {
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
          heartbeatFrequencyMS: 30000
        });

        this.handleSuccessfulConnection();
        break;
      } catch (error) {
        await this.handleConnectionError(error);
      }
    }
  }

  static handleSuccessfulConnection() {
    console.log('MongoDB connected successfully');
    connectionState.isConnected = true;
    connectionState.status = 'connected';
    connectionState.currentRetryDelay = dbConfig.INITIAL_RETRY_DELAY;
    connectionState.retryCount = 0;
    featureFlags.useDatabaseFeatures = true;
    dbEventEmitter.emit('db:connected');
  }

  static async handleConnectionError(error) {
    console.error('Database connection error:', error.message);
    connectionState.isConnected = false;
    connectionState.status = 'disconnected';
    featureFlags.useDatabaseFeatures = false;
    dbEventEmitter.emit('db:error', error);

    if (connectionState.retryCount >= dbConfig.MAX_RETRY_COUNT) {
      console.log('Max retries reached. Stopping reconnection attempts.');
      connectionState.status = 'failed';
      return;
    }

    connectionState.retryCount += 1;
    console.log(
      `Retrying connection... Attempt #${connectionState.retryCount} in ${connectionState.currentRetryDelay / 1000} seconds.`
    );

    await new Promise((resolve) => setTimeout(resolve, connectionState.currentRetryDelay));

    connectionState.currentRetryDelay = Math.min(
      connectionState.currentRetryDelay * dbConfig.RETRY_MULTIPLIER,
      dbConfig.MAX_RETRY_DELAY
    );
  }

  static async handleDisconnection() {
    console.log('Database disconnected');
    connectionState.isConnected = false;
    connectionState.status = 'disconnected';
    featureFlags.useDatabaseFeatures = false;
    dbEventEmitter.emit('db:disconnected');

    if (connectionState.retryCount < dbConfig.MAX_RETRY_COUNT) {
      await this.connect();
    }
  }

  static startHealthCheck() {
    setInterval(async () => {
      if (mongoose.connection.readyState !== 1) {
        dbEventEmitter.emit('db:unhealthy');
        await this.connect();
      }
    }, dbConfig.HEALTH_CHECK_INTERVAL);
  }

  static registerConnectionEvents() {
    mongoose.connection.on('error', this.handleConnectionError.bind(this));
    mongoose.connection.on('disconnected', this.handleDisconnection.bind(this));
  }
}

module.exports = {
  DatabaseManager,
  connectionState,
  dbEventEmitter,
  featureFlags
};
