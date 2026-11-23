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
  if (env.NODE_ENV === 'development') {
    console.log('\x1b[32m✓ MongoDB connected\x1b[0m');
  } else {
    logger.info('MongoDB connected');
  }

  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);
  startScheduler();

  server.listen(env.PORT, () => {
    if (env.NODE_ENV === 'development') {
      console.log(`\x1b[32m✓ Server listening on http://localhost:${env.PORT}\x1b[0m`);
    } else {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server listening');
    }
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
