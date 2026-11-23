import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { corsOptions } from './config/cors.js';
import { pingDb } from './config/db.js';
import { createRateLimiters } from './core/rateLimits.js';
import { assertAllRoutesGuarded, publicRoute } from './core/authz/authorize.js';
import { createAuthTokenRouter } from './core/auth/token.routes.js';
import { createUploadRouter } from './core/uploads/upload.routes.js';
import { errorHandler, notFoundHandler } from './core/errors/errorHandler.js';
import { createAuthModuleRouter } from './modules/auth/auth.routes.js';
import { createOrganizationRouter } from './modules/organization/organization.routes.js';
import { createProjectsRouter } from './modules/projects/projects.routes.js';
import { createTrackingRouter } from './modules/tracking/tracking.routes.js';
import { createCollaborationRouter } from './modules/collaboration/collaboration.routes.js';
import { createEvaluationRouter } from './modules/evaluation/evaluation.routes.js';
import { createReportsRouter } from './modules/reports/reports.routes.js';
import { createShowcaseRouter } from './modules/showcase/showcase.routes.js';

export function createApp({ mountModuleRoutes } = {}) {
  const app = express();
  const limiters = createRateLimiters();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(limiters.globalLimiter);

  app.get('/api/health', publicRoute(), async (_req, res) => {
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

  app.use('/api/v1/auth', createAuthTokenRouter());
  app.use('/api/v1/uploads', createUploadRouter(limiters.uploadSignLimiter));
  app.use('/api/v1', createAuthModuleRouter(limiters));
  app.use('/api/v1', createOrganizationRouter(limiters));
  app.use('/api/v1', createProjectsRouter(limiters));
  app.use('/api/v1', createTrackingRouter(limiters));
  app.use('/api/v1', createCollaborationRouter(limiters));
  app.use('/api/v1', createEvaluationRouter(limiters));
  app.use('/api/v1', createShowcaseRouter(limiters));
  app.use('/api/v1', createReportsRouter(limiters));

  if (typeof mountModuleRoutes === 'function') {
    mountModuleRoutes(app, limiters);
  }

  assertAllRoutesGuarded(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
