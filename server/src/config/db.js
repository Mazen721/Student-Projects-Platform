import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('sanitizeFilter', true);

export async function connectDb(uri = env.MONGO_URI) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  await mongoose.connect(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
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
