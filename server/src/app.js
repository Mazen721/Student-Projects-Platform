import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { corsOptions } from './config/cors.js';
import { pingDb } from './config/db.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());

  app.get('/api/health', async (_req, res) => {
    try {
      const dbUp = await pingDb();
      if (!dbUp) {
        return res.status(503).json({ status: 'degraded', db: 'down' });
      }
      return res.status(200).json({ status: 'ok', db: 'up' });
    } catch {
      return res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  return app;
}
