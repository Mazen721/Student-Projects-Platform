import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');

const API_PORT = Number(process.env.E2E_API_PORT || 4100);
const CLIENT_PORT = Number(process.env.E2E_CLIENT_PORT || 5179);

process.env.NODE_ENV = 'test';
process.env.PORT = String(API_PORT);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-jwt-secret-must-be-at-least-32-chars';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'e2e-refresh-secret-must-be-at-least-32-chars';
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'e2e-cloud';
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || 'e2e-api-key';
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'e2e-api-secret';
process.env.CLIENT_URL =
  process.env.CLIENT_URL || `http://localhost:${CLIENT_PORT},http://127.0.0.1:${CLIENT_PORT}`;
process.env.SEARCH_PROVIDER = 'text';
process.env.RATE_LIMIT_GLOBAL_MAX = '5000';

let replSet;
let apiServer;
let io;
let viteProc;

async function start() {
  const viteBin = path.join(
    ROOT_DIR,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'vite.cmd' : 'vite'
  );

  execFileSync(viteBin, ['build'], {
    cwd: CLIENT_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      VITE_API_URL: `http://localhost:${API_PORT}`,
    },
  });

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ launchTimeout: 30000 }],
  });
  const mongoUri = replSet.getUri();
  process.env.MONGO_URI = mongoUri;

  const [{ createApp }, { initSocket }, { seedE2EData }] = await Promise.all([
    import('../../server/src/app.js'),
    import('../../server/src/realtime/socket.js'),
    import('./seed-e2e.js'),
  ]);

  await mongoose.connect(mongoUri, { maxPoolSize: 20, serverSelectionTimeoutMS: 10000 });
  const seeded = await seedE2EData();

  const app = createApp();
  apiServer = http.createServer(app);
  io = initSocket(apiServer);

  await new Promise((resolve) => apiServer.listen(API_PORT, resolve));
  console.log(`E2E API ready on http://localhost:${API_PORT} (seed college=${seeded.collegeId})`);

  viteProc = spawn(
    viteBin,
    ['preview', '--host', 'localhost', '--port', String(CLIENT_PORT), '--strictPort'],
    {
      cwd: CLIENT_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        VITE_API_URL: `http://localhost:${API_PORT}`,
      },
    }
  );

  viteProc.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`Vite preview exited with code ${code}`);
      shutdown(code);
    }
  });
}

async function shutdown(exitCode = 0) {
  if (viteProc && !viteProc.killed) {
    viteProc.kill('SIGTERM');
  }
  if (io) io.close();
  if (apiServer) {
    await new Promise((resolve) => apiServer.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start().catch(async (err) => {
  console.error('Failed to start E2E stack:', err);
  await shutdown(1);
});
