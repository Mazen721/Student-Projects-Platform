import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('sanitizeFilter', true);

export async function connectDb(uri = env.MONGO_URI) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  const maxPoolSize = Math.min(50, Math.max(5, env.MONGO_MAX_POOL_SIZE));
  const minPoolSize = Math.min(maxPoolSize, Math.max(1, env.MONGO_MIN_POOL_SIZE));

  await mongoose.connect(uri, {
    maxPoolSize,
    minPoolSize,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
  });
  return mongoose.connection;
}

export async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function pingDb() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return false;
  }
  await mongoose.connection.db.admin().ping();
  return true;
}
