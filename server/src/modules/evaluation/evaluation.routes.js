import { Router } from 'express';
import { authorize } from '../../core/authz/authorize.js';
import { validate } from '../../core/validation/validate.js';
import { registerOnExternalExaminerAcceptedHook } from '../auth/index.js';
import { attachExternalExaminerToDefense } from './defense.service.js';
import * as ctrl from './evaluation.controller.js';
import {
  certificateParamsSchema,
  decideReevaluationSchema,
  defenseMinutesSchema,
  defenseTransitionSchema,
  externalExaminerInviteSchema,
  idParamSchema,
  listDefensesQuerySchema,
  listReevaluationsQuerySchema,
  listRubricsQuerySchema,
  reevaluationRequestSchema,
  rescheduleDefenseSchema,
  rubricSchema,
  scheduleDefenseSchema,
  scoresSchema,
  updateRubricSchema,
} from './evaluation.validation.js';

export function createEvaluationRouter(limiters) {
  const router = Router();
  const { writeLimiter } = limiters;

  registerOnExternalExaminerAcceptedHook(attachExternalExaminerToDefense);

  // Rubrics
  router.get(
    '/colleges/:id/rubrics',
    authorize('rubric.list', 'college'),
    validate({ params: idParamSchema, query: listRubricsQuerySchema }),
    ctrl.listRubricsHandler
  );
  router.post(
    '/colleges/:id/rubrics',
    authorize('rubric.create', 'college'),
    writeLimiter,
    validate({ params: idParamSchema, body: rubricSchema }),
    ctrl.createRubricHandler
  );
  router.patch(
    '/rubrics/:id',
    authorize('rubric.update', 'rubric'),
    writeLimiter,
    validate({ params: idParamSchema, body: updateRubricSchema }),
    ctrl.updateRubricHandler
  );

  // Eligibility, committees, scheduling
  router.get(
    '/projects/:id/defense/eligibility',
    authorize('defense.read', 'project'),
    validate({ params: idParamSchema }),
    ctrl.getEligibilityHandler
  );
  router.post(
    '/projects/:id/defense/sign-off',
    authorize('defense.signOff', 'project'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.signOffDefenseHandler
  );
  router.get(
    '/projects/:id/defense/examiners',
    authorize('defense.schedule', 'project'),
    validate({ params: idParamSchema }),
    ctrl.listAvailableExaminersHandler
  );
  router.post(
    '/projects/:id/defense',
    authorize('defense.schedule', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: scheduleDefenseSchema }),
    ctrl.scheduleDefenseHandler
  );
  router.patch(
    '/defenses/:id',
    authorize('defense.schedule', 'defense'),
    writeLimiter,
    validate({ params: idParamSchema, body: rescheduleDefenseSchema }),
    ctrl.rescheduleDefenseHandler
  );
  router.get(
    '/defenses',
    authorize('defense.list', 'scope'),
    validate({ query: listDefensesQuerySchema }),
    ctrl.listDefensesHandler
  );
  router.get(
    '/defenses/:id',
    authorize('defense.read', 'defense'),
    validate({ params: idParamSchema }),
    ctrl.getDefenseHandler
  );
  router.post(
    '/invitations/external-examiner',
    authorize('defense.schedule', 'defense'),
    writeLimiter,
    validate({ body: externalExaminerInviteSchema }),
    ctrl.inviteExternalExaminerHandler
  );

  // Grading & minutes
  router.get(
    '/defenses/:id/my-scoresheet',
    authorize('score.submit', 'defense'),
    validate({ params: idParamSchema }),
    ctrl.getMyScoresheetHandler
  );
  router.put(
    '/defenses/:id/my-scores',
    authorize('score.submit', 'defense'),
    writeLimiter,
    validate({ params: idParamSchema, body: scoresSchema }),
    ctrl.submitMyScoresHandler
  );
  router.get(
    '/defenses/:id/scores',
    authorize('score.viewAll', 'defense'),
    validate({ params: idParamSchema }),
    ctrl.getAllDefenseScoresHandler
  );
  router.post(
    '/defenses/:id/transitions',
    authorize('defense.transition', 'defense'),
    writeLimiter,
    validate({ params: idParamSchema, body: defenseTransitionSchema }),
    ctrl.transitionDefenseHandler
  );
  router.put(
    '/defenses/:id/minutes',
    authorize('defense.recordMinutes', 'defense'),
    writeLimiter,
    validate({ params: idParamSchema, body: defenseMinutesSchema }),
    ctrl.recordDefenseMinutesHandler
  );
  router.post(
    '/defenses/:id/modifications/confirm',
    authorize('defense.confirmModifications', 'defense'),
    writeLimiter,
    validate({ params: idParamSchema }),
    ctrl.confirmModificationsHandler
  );

  // Grades, re-evaluation, certificates
  router.get(
    '/projects/:id/grades',
    authorize('grade.read', 'project'),
    validate({ params: idParamSchema }),
    ctrl.getProjectGradesHandler
  );
  router.post(
    '/projects/:id/reevaluations',
    authorize('reeval.request', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: reevaluationRequestSchema }),
    ctrl.requestReevaluationHandler
  );
  router.get(
    '/reevaluations',
    authorize('reeval.list', 'scope'),
    validate({ query: listReevaluationsQuerySchema }),
    ctrl.listReevaluationsHandler
  );
  router.post(
    '/reevaluations/:id/decide',
    authorize('reeval.decide', 'reevaluation'),
    writeLimiter,
    validate({ params: idParamSchema, body: decideReevaluationSchema }),
    ctrl.decideReevaluationHandler
  );
  router.get(
    '/projects/:id/grades/:studentId/certificate.pdf',
    authorize('certificate.download', 'grade'),
    validate({ params: certificateParamsSchema }),
    ctrl.downloadCertificateHandler
  );

  return router;
}
