import { afterAll, afterEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.PORT ??= '0';
process.env.MONGO_URI ??= 'mongodb://127.0.0.1:27017/spp_test';
process.env.JWT_SECRET ??= 'test-jwt-secret-must-be-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-must-be-at-least-32-chars';
process.env.CLOUDINARY_CLOUD_NAME ??= 'test-cloud';
process.env.CLOUDINARY_API_KEY ??= 'test-api-key';
process.env.CLOUDINARY_API_SECRET ??= 'test-api-secret';
process.env.CLIENT_URL ??= 'http://localhost:5173';
process.env.SEARCH_PROVIDER ??= 'text';

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ launchTimeout: 30000 }],
  });
  const uri = replSet.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
});
