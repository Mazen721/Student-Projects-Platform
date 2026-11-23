import http from 'node:http';
import pino from 'pino';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' });

async function startServer() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);
  startScheduler();

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server listening');
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Shutting down server');
    stopScheduler();
    io.close();
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
