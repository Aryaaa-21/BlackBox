import mongoose from 'mongoose';
import { config } from './env';

let isConnected = false;

export const connectDatabase = async (): Promise<void> => {
  if (isConnected) {
    return;
  }

  try {
    mongoose.set('strictQuery', true);

    // Set connection options
    const options: mongoose.ConnectOptions = {
      serverSelectionTimeoutMS: 5000,
    };

    console.log(`[Database] Attempting connection to MongoDB at: ${config.mongodbUri}`);
    await mongoose.connect(config.mongodbUri, options);
    isConnected = true;
    console.log('[Database] MongoDB connected successfully');
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[Database] MongoDB connection failed: ${err.message}`);

    // In development mode, if local MongoDB is not running, provide an automatic in-memory MongoDB fallback
    if (config.nodeEnv !== 'production') {
      try {
        console.log('[Database] Starting in-memory MongoDB server fallback for development/testing...');
        // Dynamic import so production doesn't bundle memory server
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        console.log(`[Database] In-memory MongoDB started at: ${uri}`);
        await mongoose.connect(uri);
        isConnected = true;
        console.log('[Database] In-memory MongoDB connected successfully');
        return;
      } catch (fallbackError: unknown) {
        const fbErr = fallbackError as Error;
        console.error(`[Database] Fallback in-memory MongoDB also failed: ${fbErr.message}`);
      }
    }

    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log('[Database] MongoDB connection gracefully terminated');
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[Database] Error terminating MongoDB connection: ${err.message}`);
  }
};

export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

// Listeners for connection events
mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error(`[Database] Connection error: ${err}`);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB disconnected');
  isConnected = false;
});
