import { Router } from 'express';
import { authorize } from '../../core/authz/authorize.js';
import { validate } from '../../core/validation/validate.js';
import * as ctrl from './reports.controller.js';
import {
  projectsReportQuerySchema,
  reportQuerySchema,
  supervisorSelfQuerySchema,
} from './reports.validation.js';

export function createReportsRouter(_limiters) {
  const router = Router();

  router.get(
    '/reports/dashboard',
    authorize('report.dashboard', 'scope'),
    validate({ query: reportQuerySchema }),
    ctrl.getDashboardReportHandler
  );
  router.get(
    '/reports/projects',
    authorize('report.projects', 'scope'),
    validate({ query: projectsReportQuerySchema }),
    ctrl.getProjectsReportHandler
  );
  router.get(
    '/reports/completion',
    authorize('report.completion', 'scope'),
    validate({ query: reportQuerySchema }),
    ctrl.getCompletionReportHandler
  );
  router.get(
    '/reports/supervisor-distribution',
    authorize('report.supervisors', 'scope'),
    validate({ query: reportQuerySchema }),
    ctrl.getSupervisorDistributionHandler
  );
  router.get(
    '/reports/evaluation',
    authorize('report.evaluation', 'scope'),
    validate({ query: reportQuerySchema }),
    ctrl.getEvaluationReportHandler
  );
  router.get(
    '/reports/insights',
    authorize('report.insights', 'scope'),
    validate({ query: reportQuerySchema }),
    ctrl.getInsightsReportHandler
  );
  router.get(
    '/reports/supervisor/me',
    authorize('report.supervisorSelf', 'self'),
    validate({ query: supervisorSelfQuerySchema }),
    ctrl.getSupervisorSelfReportHandler
  );

  return router;
}
