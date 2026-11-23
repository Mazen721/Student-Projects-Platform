import mongoose from 'mongoose';
import {
  DEFENSE_STATES,
  MODIFICATION_STATES,
  REEVALUATION_STATUSES,
  ROLES,
  USER_STATUSES,
} from '@spp/shared/constants';
import {
  computeEvaluatorTotal,
  computePerCriterionBreakdown,
  computeSpread,
  computeStudentFinal,
  computeTeamGrade,
  gradeBand,
  spreadExceeded,
} from '@spp/shared/calc';
import { defenseMachine } from '@spp/shared/machines';
import { t } from '@spp/shared/locales/ar';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { sendBulkNotifications } from '../../core/notifications/notify.service.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { findUsersBasicByIds, listCollegeAdminIds } from '../auth/index.js';
import { getCollegesAndDepartmentsMap } from '../organization/index.js';
import { getProjectForEvaluation, updateProjectDefenseState } from '../projects/index.js';
import { logTimelineEvent } from '../tracking/index.js';
import Committee from './committee.model.js';
import Defense from './defense.model.js';
import {
  assertValidCommittee,
  getActorRoleName,
  isStaffAdmin,
  resolveCollegeSettings,
  throwMachineError,
} from './evaluationShared.js';
import ExaminerScore from './examinerScore.model.js';
import Grade from './grade.model.js';
import ReEvaluationRequest from './reevaluationRequest.model.js';
import Rubric from './rubric.model.js';

const SCORING_OPEN_STATES = new Set([
  DEFENSE_STATES.GRADING,
  DEFENSE_STATES.DELIBERATION,
  DEFENSE_STATES.REEVALUATION_OPEN,
]);

function resolveCallerComponent(defense, project, userId) {
  const uid = String(userId);
  if (project.supervision?.primaryId && String(project.supervision.primaryId) === uid) {
    return 'supervisor';
  }
  if ((defense.examinerIds || []).map(String).includes(uid)) {
    return 'committee';
  }
  return null;
}

async function getEvaluationContext(defenseId, { session = null } = {}) {
  const defQuery = Defense.findById(defenseId);
  if (session) defQuery.session(session);
  const defense = await defQuery;
  if (!defense) throw AppError.notFound();

  const [project, rubric] = await Promise.all([
    getProjectForEvaluation(defense.projectId, { session }),
    Rubric.findById(defense.rubricId).session(session || null).lean(),
  ]);
  if (!rubric) throw AppError.notFound();

  const { collegeMap } = await getCollegesAndDepartmentsMap([defense.collegeId], []);
  const settings = resolveCollegeSettings(collegeMap.get(String(defense.collegeId)));

  const activeReeval = defense.activeReevaluationId
    ? await ReEvaluationRequest.findById(defense.activeReevaluationId).session(session || null).lean()
    : null;

  return { defense, project, rubric, settings, activeReeval };
}

function getExpectedExaminerSets(defense, project) {
  const supId = project.supervision?.primaryId ? String(project.supervision.primaryId) : null;
  const committeeIds = (defense.examinerIds || []).map(String);
  return { supId, committeeIds };
}

function computeSpreadByStudent({ activeCommitteeScores, studentIds, threshold }) {
  const spread = {};
  let maxSpread = 0;
  let anyExceeded = false;

  for (const sid of studentIds.map(String)) {
    const totals = activeCommitteeScores.map((s) => Number(s.totals?.[sid] ?? 0));
    const value = computeSpread(totals);
    const exceeded = spreadExceeded(totals, threshold);
    if (value > maxSpread) maxSpread = value;
    if (exceeded) anyExceeded = true;
    spread[sid] = { spread: value, exceeded };
  }

  return { spread, maxSpread, anyExceeded };
}

function evaluateSubmissionCompleteness({ defense, project, activeScores }) {
  const { supId, committeeIds } = getExpectedExaminerSets(defense, project);
  const submittedByExaminer = new Map();
  for (const score of activeScores) {
    if (score.submittedAt) {
      submittedByExaminer.set(String(score.examinerId), score);
    }
  }
  const supSubmitted = Boolean(supId && submittedByExaminer.has(supId));
  const commSubmitted = committeeIds.every((id) => submittedByExaminer.has(id));
  return {
    allSubmitted: supSubmitted && commSubmitted,
    supSubmitted,
    commSubmitted,
    submittedByExaminer,
    supId,
    committeeIds,
  };
}

export async function getMyScoresheet(defenseId, { actor }) {
  const { defense, project, rubric, activeReeval } = await getEvaluationContext(defenseId);
  const component = resolveCallerComponent(defense, project, actor.id);
  if (!component) throw AppError.notFound();

  const studentIds = (
    defense.eligibleMemberIds?.length ? defense.eligibleMemberIds : project.activeMemberIds || []
  ).map(String);

  const [userMap, myActiveScore, allActiveScores] = await Promise.all([
    findUsersBasicByIds(studentIds),
    ExaminerScore.findOne({ defenseId, examinerId: actor.id, supersededAt: null })
      .sort({ version: -1 })
      .lean(),
    ExaminerScore.find({ defenseId, supersededAt: null })
      .select('examinerId submittedAt')
      .lean(),
  ]);

  const { supId, committeeIds } = getExpectedExaminerSets(defense, project);
  const totalExaminers = (supId ? 1 : 0) + committeeIds.length;
  const submittedCount = allActiveScores.filter((s) => Boolean(s.submittedAt)).length;

  return {
    defenseId: String(defense._id),
    projectId: String(project._id),
    projectTitle: project.title,
    state: defense.state,
    component,
    rubric: {
      id: String(rubric._id),
      name: rubric.name,
      supervisorPct: rubric.supervisorPct,
      committeePct: rubric.committeePct,
      criteria: rubric.criteria,
    },
    students: studentIds.map((id) => ({
      id,
      name: userMap.get(id)?.name || '',
      studentId: userMap.get(id)?.studentId || null,
    })),
    activeReevaluation: activeReeval
      ? {
          id: String(activeReeval._id),
          scope: activeReeval.scope,
          studentId: activeReeval.studentId ? String(activeReeval.studentId) : null,
        }
      : null,
    myScore: myActiveScore
      ? {
          version: myActiveScore.version,
          teamScores: myActiveScore.teamScores || {},
          individualScores: myActiveScore.individualScores || {},
          totals: myActiveScore.totals || {},
          submittedAt: myActiveScore.submittedAt,
        }
      : null,
    submittedCount,
    totalExaminers,
  };
}

function buildSanitizedReevalScores({
  payload,
  priorScore,
  rubric,
  targetStudentId,
}) {
  const teamScores = { ...(priorScore?.teamScores || {}) };
  const individualScores = { ...(priorScore?.individualScores || {}) };
  const incomingIndiv = payload.individualScores?.[targetStudentId] || {};
  const priorIndiv = individualScores[targetStudentId] || {};
  const mergedStudentIndiv = { ...priorIndiv };

  for (const criterion of rubric.criteria || []) {
    if (criterion.appliesTo === 'individual' && incomingIndiv[criterion.key] !== undefined) {
      mergedStudentIndiv[criterion.key] = incomingIndiv[criterion.key];
    }
  }
  individualScores[targetStudentId] = mergedStudentIndiv;
  return { teamScores, individualScores };
}

export async function submitMyScores(defenseId, payload, { actor }) {
  const { defense, project, rubric, activeReeval } = await getEvaluationContext(defenseId);
  const component = resolveCallerComponent(defense, project, actor.id);
  if (!component) throw AppError.notFound();

  if (defense.state === DEFENSE_STATES.FINALIZED) {
    throw new AppError('GRADE_LOCKED');
  }
  if (!SCORING_OPEN_STATES.has(defense.state)) {
    throw new AppError('INVALID_TRANSITION');
  }

  if (component === 'supervisor') {
    const supMap = await findUsersBasicByIds([actor.id]);
    const supUser = supMap.get(String(actor.id));
    if (!supUser || supUser.status !== USER_STATUSES.ACTIVE) {
      throw AppError.businessRule('PRIMARY_SUPERVISOR_DEACTIVATED');
    }
  }

  const studentIds = (
    defense.eligibleMemberIds?.length ? defense.eligibleMemberIds : project.activeMemberIds || []
  ).map(String);

  let teamScores = payload.teamScores || {};
  let individualScores = payload.individualScores || {};

  if (
    defense.state === DEFENSE_STATES.REEVALUATION_OPEN &&
    activeReeval?.scope === 'student' &&
    activeReeval.studentId
  ) {
    const prior = await ExaminerScore.findOne({
      defenseId,
      examinerId: actor.id,
      supersededAt: mongoose.trusted({ $ne: null }),
    })
      .sort({ version: -1 })
      .lean();
    let baseline = prior;
    if (!baseline) {
      baseline = await ExaminerScore.findOne({
        defenseId,
        component: 'committee',
        supersededAt: mongoose.trusted({ $ne: null }),
      })
        .sort({ version: -1 })
        .lean();
    }
    const sanitized = buildSanitizedReevalScores({
      payload,
      priorScore: baseline,
      rubric,
      targetStudentId: String(activeReeval.studentId),
    });
    teamScores = sanitized.teamScores;
    individualScores = sanitized.individualScores;
  }

  const totals = {};
  for (const sid of studentIds) {
    totals[sid] = computeEvaluatorTotal({
      rubric,
      teamScores,
      individualScores,
      studentId: sid,
    });
  }

  const session = await mongoose.startSession();
  let savedScore;
  let nextDefenseState = defense.state;

  try {
    await session.withTransaction(async () => {
      const existingActive = await ExaminerScore.findOne({
        defenseId,
        examinerId: actor.id,
        supersededAt: null,
      })
        .sort({ version: -1 })
        .session(session);

      if (existingActive && existingActive.submittedAt) {
        throw new AppError('INVALID_TRANSITION');
      }

      const latestVersionDoc = await ExaminerScore.findOne({ defenseId, examinerId: actor.id })
        .sort({ version: -1 })
        .select('version')
        .session(session)
        .lean();

      if (existingActive) {
        existingActive.teamScores = teamScores;
        existingActive.individualScores = individualScores;
        existingActive.totals = totals;
        if (payload.submit) existingActive.submittedAt = new Date();
        await existingActive.save({ session });
        savedScore = existingActive;
      } else {
        const [created] = await ExaminerScore.create(
          [
            {
              defenseId,
              projectId: project._id,
              examinerId: actor.id,
              component,
              version: (latestVersionDoc?.version || 0) + 1,
              revisionRound: defense.revisionRound || 0,
              reevaluationId: defense.activeReevaluationId || null,
              teamScores,
              individualScores,
              totals,
              submittedAt: payload.submit ? new Date() : null,
            },
          ],
          { session }
        );
        savedScore = created;
      }

      await Rubric.updateOne(
        { _id: rubric._id, status: mongoose.trusted({ $ne: 'locked' }) },
        { $set: { status: 'locked' } },
        { session }
      );

      if (payload.submit && defense.state === DEFENSE_STATES.DELIBERATION) {
        const activeScores = await ExaminerScore.find({ defenseId, supersededAt: null })
          .session(session)
          .lean();
        const status = evaluateSubmissionCompleteness({ defense, project, activeScores });
        if (status.allSubmitted) {
          const transition = defenseMachine.next(defense.state, 'RESUBMIT_SCORES', {
            roles: ['system'],
          });
          await Defense.updateOne(
            { _id: defenseId, state: DEFENSE_STATES.DELIBERATION },
            {
              $set: { state: transition.to },
              $push: {
                history: {
                  from: defense.state,
                  to: transition.to,
                  event: 'RESUBMIT_SCORES',
                  actorId: actor.id,
                  actorRole: getActorRoleName(actor),
                },
              },
            },
            { session }
          );
          await updateProjectDefenseState(project._id, { defenseState: transition.to }, { session });
          nextDefenseState = transition.to;
        }
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    id: String(savedScore._id),
    version: savedScore.version,
    totals: savedScore.totals,
    submittedAt: savedScore.submittedAt,
    defenseState: nextDefenseState,
  };
}

export async function getAllDefenseScores(defenseId, { actor }) {
  const { defense, project, settings } = await getEvaluationContext(defenseId);
  const activeScores = await ExaminerScore.find({ defenseId, supersededAt: null }).lean();
  const completeness = evaluateSubmissionCompleteness({ defense, project, activeScores });

  if (!completeness.allSubmitted && !isStaffAdmin(actor)) {
    throw AppError.businessRule('SCORES_INCOMPLETE');
  }

  const studentIds = (
    defense.eligibleMemberIds?.length ? defense.eligibleMemberIds : project.activeMemberIds || []
  ).map(String);

  const visibleScores = completeness.allSubmitted
    ? activeScores.filter((s) => Boolean(s.submittedAt))
    : [];
  const committeeScores = visibleScores.filter((s) => s.component === 'committee');
  const { spread, maxSpread, anyExceeded } = completeness.allSubmitted
    ? computeSpreadByStudent({
        activeCommitteeScores: committeeScores,
        studentIds,
        threshold: settings.gradeSpreadThreshold,
      })
    : { spread: {}, maxSpread: 0, anyExceeded: false };

  const examinerIds = Array.from(
    new Set([
      ...(completeness.supId ? [completeness.supId] : []),
      ...completeness.committeeIds,
      ...visibleScores.map((s) => String(s.examinerId)),
    ])
  );
  const userMap = await findUsersBasicByIds([...examinerIds, ...studentIds]);

  return {
    defenseId: String(defense._id),
    state: defense.state,
    allSubmitted: completeness.allSubmitted,
    spreadThreshold: settings.gradeSpreadThreshold,
    maxSpread,
    spreadExceeded: anyExceeded,
    spread,
    students: studentIds.map((id) => ({ id, name: userMap.get(id)?.name || '' })),
    examiners: visibleScores.map((s) => ({
      examinerId: String(s.examinerId),
      name: userMap.get(String(s.examinerId))?.name || '',
      component: s.component,
      version: s.version,
      totals: s.totals || {},
      submittedAt: s.submittedAt,
    })),
  };
}

async function handleOpenGrading({ defense, project, actor, ip, session }) {
  if (project.supervision?.primaryId) {
    const supMap = await findUsersBasicByIds([project.supervision.primaryId], session);
    const supUser = supMap.get(String(project.supervision.primaryId));
    if (!supUser || supUser.status !== USER_STATUSES.ACTIVE) {
      throw AppError.businessRule('PRIMARY_SUPERVISOR_DEACTIVATED');
    }
  }

  const callerRoles = [
    ...(String(defense.chairId) === String(actor.id) ? ['committeeChair'] : []),
    ...(actor.roles || []).map((r) => r.role),
  ];
  const transition = defenseMachine.evaluate(defense.state, 'OPEN_GRADING', { roles: callerRoles });
  if (!transition.allowed) throwMachineError(transition.code);

  const updated = await Defense.findOneAndUpdate(
    { _id: defense._id, state: defense.state },
    {
      $set: {
        state: transition.to,
        eligibleMemberIds: project.activeMemberIds || [],
      },
      $push: {
        history: {
          from: defense.state,
          to: transition.to,
          event: 'OPEN_GRADING',
          actorId: actor.id,
          actorRole: getActorRoleName(actor),
        },
      },
    },
    { new: true, session }
  );
  if (!updated) throw new AppError('CONFLICT');

  await updateProjectDefenseState(project._id, { defenseState: transition.to }, { session });
  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'defense.openGrading',
    targetType: 'defense',
    targetId: defense._id,
    scope: { collegeId: defense.collegeId, departmentId: defense.departmentId, projectId: project._id },
    before: { state: defense.state },
    after: { state: transition.to },
    ip,
    session,
  });
  return updated;
}

async function handleUnlockForRevision({ defense, project, settings, actor, ip, session }) {
  const activeScores = await ExaminerScore.find({ defenseId: defense._id, supersededAt: null })
    .session(session)
    .lean();
  const completeness = evaluateSubmissionCompleteness({ defense, project, activeScores });
  const committeeScores = activeScores.filter((s) => s.component === 'committee' && s.submittedAt);
  const studentIds = (
    defense.eligibleMemberIds?.length ? defense.eligibleMemberIds : project.activeMemberIds || []
  ).map(String);
  const { maxSpread, anyExceeded } = computeSpreadByStudent({
    activeCommitteeScores: committeeScores,
    studentIds,
    threshold: settings.gradeSpreadThreshold,
  });

  const callerRoles = String(defense.chairId) === String(actor.id) ? ['committeeChair'] : [];
  const transition = defenseMachine.evaluate(defense.state, 'UNLOCK_FOR_REVISION', {
    roles: callerRoles,
    allSubmitted: completeness.allSubmitted,
    spreadExceeded: anyExceeded,
    deliberationCount: defense.spreadFlag?.deliberationCount || 0,
  });
  if (!transition.allowed) throwMachineError(transition.code);

  const now = new Date();
  await ExaminerScore.updateMany(
    { defenseId: defense._id, component: 'committee', supersededAt: null },
    { $set: { supersededAt: now } },
    { session }
  );

  const nextDelibCount = (defense.spreadFlag?.deliberationCount || 0) + 1;
  const updated = await Defense.findOneAndUpdate(
    { _id: defense._id, state: defense.state },
    {
      $set: {
        state: transition.to,
        revisionRound: (defense.revisionRound || 0) + 1,
        spreadFlag: {
          exceeded: anyExceeded,
          maxSpread,
          deliberationCount: nextDelibCount,
          decidedBy: actor.id,
        },
      },
      $push: {
        history: {
          from: defense.state,
          to: transition.to,
          event: 'UNLOCK_FOR_REVISION',
          actorId: actor.id,
          actorRole: getActorRoleName(actor),
        },
      },
    },
    { new: true, session }
  );
  if (!updated) throw new AppError('CONFLICT');

  await updateProjectDefenseState(project._id, { defenseState: transition.to }, { session });
  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'defense.unlockDeliberation',
    targetType: 'defense',
    targetId: defense._id,
    scope: { collegeId: defense.collegeId, departmentId: defense.departmentId, projectId: project._id },
    after: { deliberationCount: nextDelibCount, maxSpread },
    ip,
    session,
  });
  return updated;
}

async function handleFinalize({ defense, project, rubric, settings, activeReeval, note, actor, ip, session }) {
  const activeScores = await ExaminerScore.find({ defenseId: defense._id, supersededAt: null })
    .session(session)
    .lean();
  const completeness = evaluateSubmissionCompleteness({ defense, project, activeScores });
  const supervisorScore = activeScores.find((s) => s.component === 'supervisor' && s.submittedAt);
  const committeeScores = activeScores.filter((s) => s.component === 'committee' && s.submittedAt);

  const allStudentIds = (
    defense.eligibleMemberIds?.length ? defense.eligibleMemberIds : project.activeMemberIds || []
  ).map(String);

  const targetStudentIds =
    defense.state === DEFENSE_STATES.REEVALUATION_OPEN &&
    activeReeval?.scope === 'student' &&
    activeReeval.studentId
      ? [String(activeReeval.studentId)]
      : allStudentIds;

  const { maxSpread, anyExceeded } = computeSpreadByStudent({
    activeCommitteeScores: committeeScores,
    studentIds: targetStudentIds,
    threshold: settings.gradeSpreadThreshold,
  });

  const callerRoles = String(defense.chairId) === String(actor.id) ? ['committeeChair'] : [];
  const transition = defenseMachine.evaluate(defense.state, 'FINALIZE', {
    roles: callerRoles,
    allSubmitted: completeness.allSubmitted,
    spreadExceeded: anyExceeded,
    note,
  });
  if (!transition.allowed) throwMachineError(transition.code);

  const now = new Date();
  const computedTeamGrade = computeTeamGrade({
    rubric,
    supervisorPct: rubric.supervisorPct,
    committeePct: rubric.committeePct,
    supervisorTeamScores: supervisorScore?.teamScores || {},
    committeeTeamScoresList: committeeScores.map((s) => s.teamScores || {}),
  });

  const oldGradesSnapshot = [];
  const newGradesSnapshot = [];

  for (const studentId of targetStudentIds) {
    const priorLatest = await Grade.findOne({
      projectId: project._id,
      studentId,
      isLatest: true,
    })
      .session(session)
      .lean();

    if (priorLatest) {
      oldGradesSnapshot.push({
        studentId,
        version: priorLatest.version,
        final: priorLatest.final,
        teamGrade: priorLatest.teamGrade,
      });
      await Grade.updateOne(
        { _id: priorLatest._id },
        { $set: { isLatest: false } },
        { session, allowSupersede: true }
      );
    }

    const supTotal = Number(supervisorScore?.totals?.[studentId] ?? 0);
    const commTotals = committeeScores.map((s) => Number(s.totals?.[studentId] ?? 0));
    const { supervisorTotal, committeeAvg, final } = computeStudentFinal({
      supervisorPct: rubric.supervisorPct,
      committeePct: rubric.committeePct,
      supervisorTotal: supTotal,
      committeeTotals: commTotals,
    });
    const perCriterion = computePerCriterionBreakdown({
      rubric,
      supervisorScores: supervisorScore,
      committeeScoresList: committeeScores,
      studentId,
    });
    const bandResult = gradeBand(final, settings.passMark);
    const teamGradeToSave =
      activeReeval?.scope === 'student' && priorLatest ? priorLatest.teamGrade : computedTeamGrade;

    const [createdGrade] = await Grade.create(
      [
        {
          projectId: project._id,
          studentId,
          defenseId: defense._id,
          collegeId: project.collegeId,
          departmentId: project.departmentId,
          academicYearId: project.academicYearId,
          academicYearLabel: project.academicYearLabel,
          version: (priorLatest?.version || 0) + 1,
          isLatest: true,
          supervisorTotal,
          committeeAvg,
          final,
          teamGrade: teamGradeToSave,
          perCriterion,
          passed: bandResult.passed,
          band: bandResult.band,
          locked: true,
          finalizedAt: now,
          finalizedBy: actor.id,
          finalizeNote: note || undefined,
          reevaluationId: activeReeval?._id || null,
        },
      ],
      { session }
    );

    newGradesSnapshot.push({
      studentId,
      version: createdGrade.version,
      final: createdGrade.final,
      teamGrade: createdGrade.teamGrade,
    });
  }

  const updated = await Defense.findOneAndUpdate(
    { _id: defense._id, state: defense.state },
    {
      $set: {
        state: transition.to,
        finalizedAt: now,
        finalizedBy: actor.id,
        activeReevaluationId: null,
        spreadFlag: {
          exceeded: anyExceeded,
          maxSpread,
          deliberationCount: defense.spreadFlag?.deliberationCount || 0,
          note: note || undefined,
          decidedBy: actor.id,
        },
      },
      $push: {
        history: {
          from: defense.state,
          to: transition.to,
          event: 'FINALIZE',
          actorId: actor.id,
          actorRole: getActorRoleName(actor),
          note,
        },
      },
    },
    { new: true, session }
  );
  if (!updated) throw new AppError('CONFLICT');

  await updateProjectDefenseState(project._id, { defenseState: transition.to }, { session });

  if (activeReeval) {
    await ReEvaluationRequest.updateOne(
      { _id: activeReeval._id },
      {
        $set: {
          status: REEVALUATION_STATUSES.COMPLETED,
          newGrades: newGradesSnapshot,
        },
      },
      { session }
    );
    await recordAudit({
      actorId: actor.id,
      actorRole: getActorRoleName(actor),
      action: 'reevaluation.finalize',
      targetType: 'reevaluation',
      targetId: activeReeval._id,
      scope: { collegeId: project.collegeId, departmentId: project.departmentId, projectId: project._id },
      before: { grades: oldGradesSnapshot },
      after: { grades: newGradesSnapshot },
      reason: note,
      ip,
      session,
    });
  }

  await logTimelineEvent({
    projectId: project._id,
    type: 'grades_finalized',
    actorId: actor.id,
    refType: 'defense',
    refId: defense._id,
    summaryKey: 'timeline.gradesFinalized',
    session,
  });

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'defense.finalize',
    targetType: 'defense',
    targetId: defense._id,
    scope: { collegeId: project.collegeId, departmentId: project.departmentId, projectId: project._id },
    before: { state: defense.state },
    after: { state: transition.to, maxSpread, grades: newGradesSnapshot },
    reason: note,
    ip,
    session,
  });

  return updated;
}

export async function transitionDefense(defenseId, { event, note }, { actor, ip }) {
  const session = await mongoose.startSession();
  let updated;
  let notifyStudentIds = [];
  let projectTitle = '';
  let projectIdStr = '';

  try {
    await session.withTransaction(async () => {
      const ctx = await getEvaluationContext(defenseId, { session });
      projectTitle = ctx.project.title;
      projectIdStr = String(ctx.project._id);

      if (event === 'OPEN_GRADING') {
        updated = await handleOpenGrading({ ...ctx, actor, ip, session });
      } else if (event === 'UNLOCK_FOR_REVISION') {
        updated = await handleUnlockForRevision({ ...ctx, actor, ip, session });
      } else if (event === 'FINALIZE') {
        updated = await handleFinalize({ ...ctx, note, actor, ip, session });
        notifyStudentIds = (
          ctx.defense.eligibleMemberIds?.length
            ? ctx.defense.eligibleMemberIds
            : ctx.project.activeMemberIds || []
        ).map(String);
      } else {
        throw new AppError('INVALID_TRANSITION');
      }
    });
  } finally {
    await session.endSession();
  }

  if (notifyStudentIds.length > 0) {
    await sendBulkNotifications(
      notifyStudentIds.map((userId) => ({
        userId,
        type: 'grades_finalized',
        titleKey: 'notifications.gradesFinalizedTitle',
        bodyKey: 'notifications.gradesFinalizedBody',
        vars: { project: projectTitle },
        link: `/app/projects/${projectIdStr}`,
      }))
    );
  }

  return {
    id: String(updated._id),
    state: updated.state,
    spreadFlag: updated.spreadFlag,
    finalizedAt: updated.finalizedAt,
  };
}

export async function recordDefenseMinutes(defenseId, payload, { actor }) {
  const defense = await Defense.findById(defenseId);
  if (!defense) throw AppError.notFound();

  defense.minutes = payload.minutes;
  if (payload.recommendations !== undefined) {
    defense.recommendations = payload.recommendations;
  }
  if (payload.modifications) {
    const reqMod = Boolean(payload.modifications.required);
    defense.modifications = {
      required: reqMod,
      description: payload.modifications.description || '',
      deadline: payload.modifications.deadline || null,
      state: reqMod ? MODIFICATION_STATES.PENDING : MODIFICATION_STATES.NONE,
    };
  }
  await defense.save();

  return {
    id: String(defense._id),
    minutes: defense.minutes,
    recommendations: defense.recommendations,
    modifications: defense.modifications,
    recordedBy: String(actor.id),
  };
}

export async function confirmModifications(defenseId, { actor }) {
  const defense = await Defense.findById(defenseId);
  if (!defense) throw AppError.notFound();

  if (!defense.modifications?.required) {
    throw new AppError('INVALID_TRANSITION');
  }

  defense.modifications.state = MODIFICATION_STATES.CONFIRMED;
  defense.modifications.confirmedBy = actor.id;
  defense.modifications.confirmedAt = new Date();
  await defense.save();

  return {
    id: String(defense._id),
    modifications: defense.modifications,
  };
}

function formatGradeForViewer(grade, { criterionMap, userMap, hideBreakdown = false }) {
  const stu = userMap.get(String(grade.studentId));
  const base = {
    id: String(grade._id),
    projectId: String(grade.projectId),
    studentId: String(grade.studentId),
    studentName: stu?.name || '',
    studentUniversityId: stu?.studentId || null,
    version: grade.version,
    final: grade.final,
    teamGrade: grade.teamGrade,
    passed: grade.passed,
    band: grade.band,
    bandLabel: t(`gradeBands.${grade.band}`),
    finalizedAt: grade.finalizedAt,
  };
  if (hideBreakdown) return base;
  return {
    ...base,
    supervisorTotal: grade.supervisorTotal,
    committeeAvg: grade.committeeAvg,
    perCriterion: (grade.perCriterion || []).map((pc) => ({
      ...pc,
      name: criterionMap.get(pc.key)?.name || pc.key,
      weight: criterionMap.get(pc.key)?.weight || 0,
      appliesTo: criterionMap.get(pc.key)?.appliesTo || 'team',
    })),
  };
}

export async function getProjectGrades(projectId, { actor }) {
  const project = await getProjectForEvaluation(projectId);
  const grades = await Grade.find({ projectId, locked: true, isLatest: true })
    .sort({ createdAt: 1 })
    .lean();

  if (grades.length === 0) {
    return { finalized: false };
  }

  const defense = await Defense.findById(grades[0].defenseId).lean();
  const rubric = defense ? await Rubric.findById(defense.rubricId).lean() : null;
  const criterionMap = new Map((rubric?.criteria || []).map((c) => [c.key, c]));
  const userMap = await findUsersBasicByIds(grades.map((g) => g.studentId));

  const actorId = String(actor.id);
  const isMember = (project.activeMemberIds || []).map(String).includes(actorId);
  const isSupervisor = (project.supervisorIds || []).map(String).includes(actorId);
  const roles = Array.isArray(actor.roles) ? actor.roles : [];

  const isPrimaryCollegeOrUniStaff = roles.some(
    (r) =>
      r.role === ROLES.UNIVERSITY_ADMIN ||
      (r.role === ROLES.COLLEGE_ADMIN && String(r.collegeId ?? r.scopeId) === String(project.collegeId)) ||
      (r.role === ROLES.DEPARTMENT_ADMIN &&
        String(r.departmentId ?? r.scopeId) === String(project.departmentId))
  );

  if (isMember && !isSupervisor && !isPrimaryCollegeOrUniStaff) {
    const own = grades.find((g) => String(g.studentId) === actorId);
    if (!own) return { finalized: false };
    const existingReeval = await ReEvaluationRequest.findOne({
      projectId,
      $or: [{ studentId: actor.id }, { scope: 'project' }],
    }).lean();

    return {
      finalized: true,
      defenseState: defense?.state || project.defenseState,
      finalizedAt: own.finalizedAt,
      modifications: defense?.modifications || null,
      myGrade: formatGradeForViewer(own, { criterionMap, userMap }),
      myReevaluation: existingReeval
        ? { id: String(existingReeval._id), status: existingReeval.status, scope: existingReeval.scope }
        : null,
    };
  }

  // Partner-college/department admin (not in primary college/dept, not supervisor): see only their college/dept students' finals
  if (!isPrimaryCollegeOrUniStaff && !isSupervisor) {
    const partnerCollegeIds = new Set(
      roles
        .filter((r) => r.role === ROLES.COLLEGE_ADMIN)
        .map((r) => String(r.collegeId ?? r.scopeId))
    );
    const partnerDeptIds = new Set(
      roles
        .filter((r) => r.role === ROLES.DEPARTMENT_ADMIN)
        .map((r) => String(r.departmentId ?? r.scopeId))
    );
    const filtered = grades.filter((g) => {
      const stu = userMap.get(String(g.studentId));
      return (
        partnerCollegeIds.has(String(stu?.collegeId)) ||
        partnerDeptIds.has(String(stu?.departmentId))
      );
    });
    return {
      finalized: true,
      defenseState: defense?.state || project.defenseState,
      finalizedAt: grades[0].finalizedAt,
      grades: filtered.map((g) => formatGradeForViewer(g, { criterionMap, userMap, hideBreakdown: true })),
    };
  }

  return {
    finalized: true,
    defenseState: defense?.state || project.defenseState,
    finalizedAt: grades[0].finalizedAt,
    modifications: defense?.modifications || null,
    grades: grades.map((g) => formatGradeForViewer(g, { criterionMap, userMap })),
  };
}

export async function requestReevaluation(projectId, payload, { actor, ip }) {
  const project = await getProjectForEvaluation(projectId);
  const defense = await Defense.findOne({ projectId });
  if (!defense || !defense.finalizedAt) {
    throw new AppError('INVALID_TRANSITION');
  }

  const isPrimarySup =
    project.supervision?.primaryId && String(project.supervision.primaryId) === String(actor.id);
  const isMember = (project.activeMemberIds || []).map(String).includes(String(actor.id));
  if (!isPrimarySup && !isMember) {
    throw AppError.forbidden();
  }

  const scope = isPrimarySup ? 'project' : 'student';
  const targetStudentId = isPrimarySup ? null : actor.id;

  const { collegeMap } = await getCollegesAndDepartmentsMap([project.collegeId], []);
  const settings = resolveCollegeSettings(collegeMap.get(String(project.collegeId)));
  const deadlineMs =
    new Date(defense.finalizedAt).getTime() + settings.reevaluationWindowDays * 86400000;
  const windowOpen = settings.reevaluationWindowDays > 0 && Date.now() <= deadlineMs;

  const [existingProjectWide, existingOwn, completedAny] = await Promise.all([
    ReEvaluationRequest.findOne({ projectId, scope: 'project' }).lean(),
    targetStudentId
      ? ReEvaluationRequest.findOne({ projectId, studentId: targetStudentId }).lean()
      : null,
    ReEvaluationRequest.findOne({ projectId, status: REEVALUATION_STATUSES.COMPLETED }).lean(),
  ]);

  const alreadyRequested = Boolean(existingProjectWide || existingOwn || completedAny);

  // Allow concurrent student requests when defense is finalized or already has another pending student request
  const machineState =
    defense.state === DEFENSE_STATES.REEVALUATION_REQUESTED && scope === 'student'
      ? DEFENSE_STATES.FINALIZED
      : defense.state;

  const transition = defenseMachine.evaluate(machineState, 'REQUEST_REEVAL', {
    roles: isPrimarySup ? ['primarySupervisor'] : [ROLES.STUDENT],
    windowOpen,
    alreadyRequested,
  });
  if (!transition.allowed) throwMachineError(transition.code);

  const oldGrades = await Grade.find({
    projectId,
    isLatest: true,
    ...(targetStudentId ? { studentId: targetStudentId } : {}),
  })
    .select('studentId version final teamGrade')
    .lean();

  if (oldGrades.length === 0) {
    throw new AppError('INVALID_TRANSITION');
  }

  const session = await mongoose.startSession();
  let created;

  try {
    await session.withTransaction(async () => {
      const [doc] = await ReEvaluationRequest.create(
        [
          {
            projectId,
            defenseId: defense._id,
            collegeId: project.collegeId,
            departmentId: project.departmentId,
            academicYearId: project.academicYearId,
            scope,
            studentId: targetStudentId,
            requestedBy: actor.id,
            requesterRole: isPrimarySup ? 'supervisor' : 'student',
            reason: payload.reason,
            status: REEVALUATION_STATUSES.PENDING,
            oldGrades: oldGrades.map((g) => ({
              studentId: String(g.studentId),
              version: g.version,
              final: g.final,
              teamGrade: g.teamGrade,
            })),
          },
        ],
        { session }
      );
      created = doc;

      if (defense.state !== DEFENSE_STATES.REEVALUATION_REQUESTED) {
        defense.state = DEFENSE_STATES.REEVALUATION_REQUESTED;
        defense.history.push({
          from: DEFENSE_STATES.FINALIZED,
          to: DEFENSE_STATES.REEVALUATION_REQUESTED,
          event: 'REQUEST_REEVAL',
          actorId: actor.id,
          actorRole: getActorRoleName(actor),
          note: payload.reason,
        });
        await defense.save({ session });
        await updateProjectDefenseState(
          projectId,
          { defenseState: DEFENSE_STATES.REEVALUATION_REQUESTED },
          { session }
        );
      }

      await recordAudit({
        actorId: actor.id,
        actorRole: getActorRoleName(actor),
        action: 'reevaluation.request',
        targetType: 'reevaluation',
        targetId: doc._id,
        scope: { collegeId: project.collegeId, departmentId: project.departmentId, projectId },
        after: { scope, studentId: targetStudentId, reason: payload.reason },
        ip,
        session,
      });
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw AppError.businessRule('REEVAL_ALREADY_REQUESTED');
    }
    throw err;
  } finally {
    await session.endSession();
  }

  const adminIds = await listCollegeAdminIds(project.collegeId);
  await sendBulkNotifications(
    adminIds.map((userId) => ({
      userId,
      type: 'reeval_requested',
      titleKey: 'notifications.reevalRequestedTitle',
      bodyKey: 'notifications.reevalRequestedBody',
      vars: { project: project.title },
      link: '/app/reevaluations',
    }))
  );

  return {
    id: String(created._id),
    projectId: String(created.projectId),
    scope: created.scope,
    studentId: created.studentId ? String(created.studentId) : null,
    status: created.status,
    reason: created.reason,
    createdAt: created.createdAt,
  };
}

export async function listReevaluations(scopeFilter, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, ['-createdAt', 'createdAt']);
  const filter = { ...scopeFilter };
  if (query.status) filter.status = query.status;

  const [docs, total] = await Promise.all([
    ReEvaluationRequest.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ReEvaluationRequest.countDocuments(filter),
  ]);

  const userIds = docs.flatMap((d) => [d.requestedBy, d.studentId, d.decidedBy].filter(Boolean));
  const projectIds = [...new Set(docs.map((d) => String(d.projectId)))];
  const [userMap, projects] = await Promise.all([
    findUsersBasicByIds(userIds),
    Promise.all(projectIds.map((pid) => getProjectForEvaluation(pid).catch(() => null))),
  ]);
  const projectMap = new Map(projects.filter(Boolean).map((p) => [String(p._id), p]));

  return {
    items: docs.map((d) => ({
      ...d,
      id: String(d._id),
      projectId: String(d.projectId),
      projectTitle: projectMap.get(String(d.projectId))?.title || '',
      defenseId: String(d.defenseId),
      studentId: d.studentId ? String(d.studentId) : null,
      studentName: d.studentId ? userMap.get(String(d.studentId))?.name || '' : null,
      requestedBy: String(d.requestedBy),
      requesterName: userMap.get(String(d.requestedBy))?.name || '',
    })),
    page: buildPageMeta({ page, limit, total }),
  };
}

export async function decideReevaluation(reevalId, payload, { actor, ip }) {
  const reeval = await ReEvaluationRequest.findById(reevalId);
  if (!reeval) throw AppError.notFound();
  if (reeval.status !== REEVALUATION_STATUSES.PENDING) {
    throw new AppError('INVALID_TRANSITION');
  }

  const defense = await Defense.findById(reeval.defenseId);
  if (!defense) throw AppError.notFound();
  const project = await getProjectForEvaluation(reeval.projectId);

  const event = payload.decision === 'approve' ? 'APPROVE_REEVAL' : 'REJECT_REEVAL';
  const callerRoles = (actor.roles || []).map((r) => r.role);
  const transition = defenseMachine.evaluate(defense.state, event, {
    roles: callerRoles,
    note: payload.note,
  });
  if (!transition.allowed) throwMachineError(transition.code);

  let replacementExaminerIds = null;
  if (payload.decision === 'approve' && payload.replacementCommittee) {
    const validated = await assertValidCommittee(payload.replacementCommittee, project);
    replacementExaminerIds = validated.examinerIds;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      reeval.status =
        payload.decision === 'approve'
          ? REEVALUATION_STATUSES.APPROVED
          : REEVALUATION_STATUSES.REJECTED;
      reeval.decidedBy = actor.id;
      reeval.decidedAt = now;
      reeval.decisionNote = payload.note;

      if (payload.decision === 'approve') {
        if (replacementExaminerIds) {
          const [newCommittee] = await Committee.create(
            [
              {
                projectId: project._id,
                defenseId: defense._id,
                chairId: payload.replacementCommittee.chairId,
                memberIds: payload.replacementCommittee.memberIds || [],
                externalExaminerIds: payload.replacementCommittee.externalExaminerIds || [],
                createdBy: actor.id,
              },
            ],
            { session }
          );
          reeval.replacementCommitteeId = newCommittee._id;
          defense.committeeId = newCommittee._id;
          defense.chairId = payload.replacementCommittee.chairId;
          defense.examinerIds = replacementExaminerIds;
        }

        // Prior supervisor score carries over; supersede committee scores so committee re-grades
        await ExaminerScore.updateMany(
          { defenseId: defense._id, component: 'committee', supersededAt: null },
          { $set: { supersededAt: now } },
          { session }
        );

        defense.state = DEFENSE_STATES.REEVALUATION_OPEN;
        defense.activeReevaluationId = reeval._id;
        defense.revisionRound = (defense.revisionRound || 0) + 1;
        defense.spreadFlag = {
          exceeded: false,
          maxSpread: 0,
          deliberationCount: 0,
        };
      } else {
        const remainingPending = await ReEvaluationRequest.countDocuments({
          projectId: project._id,
          _id: mongoose.trusted({ $ne: reeval._id }),
          status: REEVALUATION_STATUSES.PENDING,
        }).session(session);
        defense.state =
          remainingPending > 0 ? DEFENSE_STATES.REEVALUATION_REQUESTED : DEFENSE_STATES.FINALIZED;
      }

      defense.history.push({
        from: DEFENSE_STATES.REEVALUATION_REQUESTED,
        to: defense.state,
        event,
        actorId: actor.id,
        actorRole: getActorRoleName(actor),
        note: payload.note,
      });

      await reeval.save({ session });
      await defense.save({ session });
      await updateProjectDefenseState(project._id, { defenseState: defense.state }, { session });

      await recordAudit({
        actorId: actor.id,
        actorRole: getActorRoleName(actor),
        action: 'reevaluation.decide',
        targetType: 'reevaluation',
        targetId: reeval._id,
        scope: { collegeId: project.collegeId, departmentId: project.departmentId, projectId: project._id },
        before: { status: REEVALUATION_STATUSES.PENDING },
        after: {
          status: reeval.status,
          decisionNote: payload.note,
          replacementCommitteeId: reeval.replacementCommitteeId,
        },
        reason: payload.note,
        ip,
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  const notifyIds = Array.from(
    new Set([
      String(reeval.requestedBy),
      ...(payload.decision === 'approve' ? (defense.examinerIds || []).map(String) : []),
    ])
  );
  await sendBulkNotifications(
    notifyIds.map((userId) => ({
      userId,
      type: 'reeval_decided',
      titleKey: 'notifications.reevalDecidedTitle',
      bodyKey: 'notifications.reevalDecidedBody',
      vars: { project: project.title },
      link: `/app/projects/${project._id}`,
    }))
  );

  return {
    id: String(reeval._id),
    status: reeval.status,
    defenseState: defense.state,
    decisionNote: reeval.decisionNote,
    replacementCommitteeId: reeval.replacementCommitteeId
      ? String(reeval.replacementCommitteeId)
      : null,
  };
}
