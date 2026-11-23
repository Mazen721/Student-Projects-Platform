import { Router } from 'express';
import { authorize } from '../../core/authz/authorize.js';
import { validate } from '../../core/validation/validate.js';
import { registerOnProjectApprovedHook } from '../projects/index.js';
import { copyPhaseTemplateToProject } from './phases.service.js';
import * as ctrl from './tracking.controller.js';
import {
  adjustPhaseSchema,
  bomItemParamSchema,
  bomItemSchema,
  createSubmissionSchema,
  deliverableParamSchema,
  idParamSchema,
  meetingActionParamSchema,
  meetingSchema,
  milestoneSchema,
  phaseParamSchema,
  phaseTemplateSchema,
  reopenPhaseBodySchema,
  reviewSubmissionSchema,
  statusFlagSchema,
  taskParamSchema,
  taskSchema,
  timelineQuerySchema,
  toolItemParamSchema,
  toolItemSchema,
  updateBomItemSchema,
  updatePhaseTemplateSchema,
  updateTaskSchema,
} from './tracking.validation.js';

export function createTrackingRouter(limiters) {
  const router = Router();
  const { writeLimiter } = limiters;

  registerOnProjectApprovedHook(copyPhaseTemplateToProject);

  router.get(
    '/colleges/:id/phase-templates',
    authorize('phaseTemplate.list', 'college'),
    validate({ params: idParamSchema }),
    ctrl.listPhaseTemplatesHandler
  );
  router.post(
    '/colleges/:id/phase-templates',
    authorize('phaseTemplate.create', 'college'),
    writeLimiter,
    validate({ params: idParamSchema, body: phaseTemplateSchema }),
    ctrl.createPhaseTemplateHandler
  );
  router.patch(
    '/phase-templates/:id',
    authorize('phaseTemplate.update', 'phaseTemplate'),
    writeLimiter,
    validate({ params: idParamSchema, body: updatePhaseTemplateSchema }),
    ctrl.updatePhaseTemplateHandler
  );

  router.get(
    '/projects/:id/phases',
    authorize('project.read', 'project'),
    validate({ params: idParamSchema }),
    ctrl.getProjectPhasesHandler
  );
  router.patch(
    '/projects/:id/phases/:phaseId',
    authorize('phase.adjust', 'project'),
    writeLimiter,
    validate({ params: phaseParamSchema, body: adjustPhaseSchema }),
    ctrl.adjustPhaseHandler
  );
  router.post(
    '/projects/:id/phases/:phaseId/complete',
    authorize('phase.markComplete', 'project'),
    writeLimiter,
    validate({ params: phaseParamSchema }),
    ctrl.completePhaseHandler
  );
  router.post(
    '/projects/:id/phases/:phaseId/reopen',
    authorize('phase.markComplete', 'project'),
    writeLimiter,
    validate({ params: phaseParamSchema, body: reopenPhaseBodySchema }),
    ctrl.reopenPhaseHandler
  );
  router.post(
    '/projects/:id/phases/:phaseId/milestones',
    authorize('phase.adjust', 'project'),
    writeLimiter,
    validate({ params: phaseParamSchema, body: milestoneSchema }),
    ctrl.addMilestoneHandler
  );

  router.post(
    '/projects/:id/deliverables/:deliverableId/submissions',
    authorize('submission.create', 'project'),
    writeLimiter,
    validate({ params: deliverableParamSchema, body: createSubmissionSchema }),
    ctrl.createSubmissionHandler
  );
  router.get(
    '/projects/:id/deliverables/:deliverableId/submissions',
    authorize('project.read', 'project'),
    validate({ params: deliverableParamSchema }),
    ctrl.listSubmissionsHandler
  );
  router.post(
    '/submissions/:id/review',
    authorize('submission.review', 'submission'),
    writeLimiter,
    validate({ params: idParamSchema, body: reviewSubmissionSchema }),
    ctrl.reviewSubmissionHandler
  );

  router.patch(
    '/projects/:id/status-flag',
    authorize('project.setStatusFlag', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: statusFlagSchema }),
    ctrl.setStatusFlagHandler
  );
  router.get(
    '/projects/:id/timeline',
    authorize('project.read', 'project'),
    validate({ params: idParamSchema, query: timelineQuerySchema }),
    ctrl.getTimelineHandler
  );

  router.get(
    '/projects/:id/tasks',
    authorize('task.list', 'project'),
    validate({ params: idParamSchema }),
    ctrl.listTasksHandler
  );
  router.post(
    '/projects/:id/tasks',
    authorize('task.create', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: taskSchema }),
    ctrl.createTaskHandler
  );
  router.patch(
    '/tasks/:taskId',
    authorize('task.update', 'task'),
    writeLimiter,
    validate({ params: taskParamSchema, body: updateTaskSchema }),
    ctrl.updateTaskHandler
  );
  router.delete(
    '/tasks/:taskId',
    authorize('task.delete', 'task'),
    writeLimiter,
    validate({ params: taskParamSchema }),
    ctrl.deleteTaskHandler
  );

  router.get(
    '/projects/:id/bom',
    authorize('bom.read', 'project'),
    validate({ params: idParamSchema }),
    ctrl.listBomHandler
  );
  router.post(
    '/projects/:id/bom',
    authorize('bom.write', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: bomItemSchema }),
    ctrl.createBomItemHandler
  );
  router.patch(
    '/bom/:itemId',
    authorize('bom.write', 'bomItem'),
    writeLimiter,
    validate({ params: bomItemParamSchema, body: updateBomItemSchema }),
    ctrl.updateBomItemHandler
  );
  router.delete(
    '/bom/:itemId',
    authorize('bom.write', 'bomItem'),
    writeLimiter,
    validate({ params: bomItemParamSchema }),
    ctrl.deleteBomItemHandler
  );

  router.get(
    '/projects/:id/tools',
    authorize('tools.read', 'project'),
    validate({ params: idParamSchema }),
    ctrl.listToolsHandler
  );
  router.post(
    '/projects/:id/tools',
    authorize('tools.write', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: toolItemSchema }),
    ctrl.createToolItemHandler
  );
  router.delete(
    '/tools/:toolId',
    authorize('tools.write', 'toolItem'),
    writeLimiter,
    validate({ params: toolItemParamSchema }),
    ctrl.deleteToolItemHandler
  );

  router.get(
    '/projects/:id/meetings',
    authorize('meeting.read', 'project'),
    validate({ params: idParamSchema }),
    ctrl.listMeetingsHandler
  );
  router.post(
    '/projects/:id/meetings',
    authorize('meeting.write', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: meetingSchema }),
    ctrl.createMeetingHandler
  );
  router.post(
    '/meetings/:meetingId/action-items/:index/to-task',
    authorize('task.create', 'meeting'),
    writeLimiter,
    validate({ params: meetingActionParamSchema }),
    ctrl.convertActionItemHandler
  );

  return router;
}
