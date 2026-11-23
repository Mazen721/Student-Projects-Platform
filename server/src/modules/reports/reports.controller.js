import { parsePagination } from '../../core/pagination.js';
import { sendReportExport } from './reports.export.js';
import * as reportsService from './reports.service.js';

function respondReport(reportKind, serviceFn) {
  return async (req, res, next) => {
    try {
      const result = await serviceFn({
        scopeFilter: req.scopeFilter || {},
        query: req.query,
        user: req.effectiveUser || req.user,
        pagination: req.query,
      });

      const format = req.query.format || 'json';
      if (format === 'xlsx' || format === 'pdf') {
        await sendReportExport({ reportKind, result, format, res });
        return;
      }

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const getDashboardReportHandler = respondReport(
  'dashboard',
  reportsService.getDashboardReport
);
export const getProjectsReportHandler = respondReport('projects', async ({ scopeFilter, query }) => {
  const pagination = parsePagination(query, ['-createdAt', 'createdAt', 'title', '-progress.percent']);
  return reportsService.getProjectsReport({ scopeFilter, query, pagination });
});
export const getCompletionReportHandler = respondReport(
  'completion',
  reportsService.getCompletionReport
);
export const getSupervisorDistributionHandler = respondReport(
  'supervisor-distribution',
  reportsService.getSupervisorDistributionReport
);
export const getEvaluationReportHandler = respondReport(
  'evaluation',
  reportsService.getEvaluationReport
);
export const getInsightsReportHandler = respondReport('insights', reportsService.getInsightsReport);
export const getSupervisorSelfReportHandler = respondReport(
  'supervisor-me',
  reportsService.getSupervisorSelfReport
);
