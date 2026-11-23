import mongoose from 'mongoose';
import {
  DEFENSE_STATES,
  ROLES,
  RUBRIC_STATUSES,
} from '@spp/shared/constants';
import { defenseMachine } from '@spp/shared/machines';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { sendBulkNotifications } from '../../core/notifications/notify.service.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import {
  createExternalExaminerInvitation,
  findUsersBasicByIds,
  listActiveExaminersInCollege,
} from '../auth/index.js';
import { getCollegesAndDepartmentsMap } from '../organization/index.js';
import { getProjectForEvaluation, updateProjectDefenseState } from '../projects/index.js';
import { checkProjectPhasesEligibility, logTimelineEvent } from '../tracking/index.js';
import Committee from './committee.model.js';
import Defense from './defense.model.js';
import {
  assertValidCommittee,
  findScheduleConflicts,
  getActorRoleName,
  throwMachineError,
} from './evaluationShared.js';
import ExaminerScore from './examinerScore.model.js';
import Rubric from './rubric.model.js';

function serializeRubric(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...plain,
    id: String(plain._id),
    collegeId: String(plain.collegeId),
    academicYearId: String(plain.academicYearId),
  };
}

function serializeDefense(doc, { projectMap = new Map(), userMap = new Map(), committee = null } = {}) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const proj = projectMap.get(String(plain.projectId));
  return {
    ...plain,
    id: String(plain._id),
    projectId: String(plain.projectId),
    projectTitle: proj?.title || '',
    collegeId: String(plain.collegeId),
    departmentId: String(plain.departmentId),
    academicYearId: String(plain.academicYearId),
    rubricId: String(plain.rubricId),
    committeeId: String(plain.committeeId),
    chairId: String(plain.chairId),
    chairName: userMap.get(String(plain.chairId))?.name || '',
    examinerIds: (plain.examinerIds || []).map(String),
    examiners: (plain.examinerIds || []).map((id) => ({
      id: String(id),
      name: userMap.get(String(id))?.name || '',
      isChair: String(id) === String(plain.chairId),
    })),
    committee: committee
      ? {
          id: String(committee._id),
          chairId: String(committee.chairId),
          memberIds: (committee.memberIds || []).map(String),
          externalExaminerIds: (committee.externalExaminerIds || []).map(String),
        }
      : undefined,
  };
}

export async function listRubrics(collegeId, query = {}) {
  const filter = { collegeId };
  if (query.academicYearId) filter.academicYearId = query.academicYearId;
  const docs = await Rubric.find(filter).sort({ createdAt: -1 }).lean();
  return docs.map(serializeRubric);
}

export async function createRubric(collegeId, payload, { actor, ip }) {
  const doc = await Rubric.create({
    collegeId,
    academicYearId: payload.academicYearId,
    name: payload.name,
    supervisorPct: payload.supervisorPct,
    committeePct: payload.committeePct,
    criteria: payload.criteria,
    status: RUBRIC_STATUSES.ACTIVE,
  });

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'rubric.create',
    targetType: 'rubric',
    targetId: doc._id,
    scope: { collegeId },
    after: { name: doc.name, supervisorPct: doc.supervisorPct, committeePct: doc.committeePct },
    ip,
  });

  return serializeRubric(doc);
}

export async function updateRubric(rubricId, payload, { actor, ip }) {
  const rubric = await Rubric.findById(rubricId);
  if (!rubric) throw AppError.notFound();

  const usedInDefense = await Defense.find({ rubricId }).select('_id').lean();
  const defenseIds = usedInDefense.map((d) => d._id);
  const hasScores =
    defenseIds.length > 0 &&
    (await ExaminerScore.exists({ defenseId: mongoose.trusted({ $in: defenseIds }) }));

  if (rubric.status === RUBRIC_STATUSES.LOCKED || hasScores) {
    throw AppError.businessRule('RUBRIC_IN_USE');
  }

  const before = { name: rubric.name, supervisorPct: rubric.supervisorPct, committeePct: rubric.committeePct };
  if (payload.name !== undefined) rubric.name = payload.name;
  if (payload.supervisorPct !== undefined) rubric.supervisorPct = payload.supervisorPct;
  if (payload.committeePct !== undefined) rubric.committeePct = payload.committeePct;
  if (payload.criteria !== undefined) rubric.criteria = payload.criteria;
  await rubric.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'rubric.update',
    targetType: 'rubric',
    targetId: rubric._id,
    scope: { collegeId: rubric.collegeId },
    before,
    after: { name: rubric.name, supervisorPct: rubric.supervisorPct, committeePct: rubric.committeePct },
    ip,
  });

  return serializeRubric(rubric);
}

export async function getDefenseEligibility(projectId) {
  const project = await getProjectForEvaluation(projectId);
  const { allPhasesApproved, missingPhases } = await checkProjectPhasesEligibility(projectId);
  const signedOff = Boolean(project.supervisorSignOff?.at) && project.defenseState !== DEFENSE_STATES.NOT_ELIGIBLE;
  const defense = await Defense.findOne({ projectId }).select('_id state scheduledAt').lean();
  return {
    eligible: allPhasesApproved && signedOff,
    allPhasesApproved,
    signedOff,
    defenseState: project.defenseState,
    defenseId: defense ? String(defense._id) : null,
    missingPhases,
  };
}

export async function signOffForDefense(projectId, { actor, ip }) {
  const project = await getProjectForEvaluation(projectId);
  const { allPhasesApproved, missingPhases } = await checkProjectPhasesEligibility(projectId);

  const outcome = defenseMachine.evaluate(project.defenseState, 'SIGN_OFF', {
    roles: ['primarySupervisor'],
    allPhasesApproved,
  });
  if (!outcome.allowed) {
    if (outcome.code === 'NOT_ELIGIBLE_FOR_DEFENSE') {
      throw new AppError('BUSINESS_RULE', {
        rule: 'NOT_ELIGIBLE_FOR_DEFENSE',
        details: { missingPhases },
      });
    }
    throwMachineError(outcome.code);
  }

  const signOff = { by: actor.id, at: new Date() };
  await updateProjectDefenseState(projectId, {
    defenseState: outcome.to,
    supervisorSignOff: signOff,
  });

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'defense.signOff',
    targetType: 'project',
    targetId: project._id,
    scope: { collegeId: project.collegeId, departmentId: project.departmentId, projectId: project._id },
    before: { defenseState: project.defenseState },
    after: { defenseState: outcome.to },
    ip,
  });

  return {
    eligible: true,
    signedOff: true,
    defenseState: outcome.to,
    missingPhases: [],
  };
}

export async function scheduleDefense(projectId, payload, { actor, ip }) {
  const project = await getProjectForEvaluation(projectId);
  if (project.defenseState === DEFENSE_STATES.NOT_ELIGIBLE) {
    throw AppError.businessRule('NOT_ELIGIBLE_FOR_DEFENSE');
  }
  if (project.defenseState !== DEFENSE_STATES.ELIGIBLE) {
    throw new AppError('DEFENSE_ALREADY_SCHEDULED');
  }

  const { examinerIds } = await assertValidCommittee(payload.committee, project);
  const outcome = defenseMachine.evaluate(project.defenseState, 'SCHEDULE', {
    roles: [ROLES.DEPARTMENT_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.UNIVERSITY_ADMIN],
    validCommittee: true,
  });
  if (!outcome.allowed) throwMachineError(outcome.code);

  const rubric = await Rubric.findOne({
    collegeId: project.collegeId,
    academicYearId: project.academicYearId,
    status: mongoose.trusted({ $ne: RUBRIC_STATUSES.DRAFT }),
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!rubric) {
    throw AppError.businessRule('NO_ACTIVE_RUBRIC');
  }

  const conflicts = await findScheduleConflicts({
    scheduledAt: payload.scheduledAt,
    durationMin: payload.durationMin,
    room: payload.room,
    examinerIds,
  });
  if (conflicts.length > 0 && !payload.acknowledgeConflicts) {
    throw new AppError('CONFLICT', { details: { conflicts } });
  }

  const session = await mongoose.startSession();
  let createdDefense;
  let createdCommittee;

  try {
    await session.withTransaction(async () => {
      const [committee] = await Committee.create(
        [
          {
            projectId: project._id,
            chairId: payload.committee.chairId,
            memberIds: payload.committee.memberIds || [],
            externalExaminerIds: payload.committee.externalExaminerIds || [],
            createdBy: actor.id,
          },
        ],
        { session }
      );
      createdCommittee = committee;

      const [defense] = await Defense.create(
        [
          {
            projectId: project._id,
            collegeId: project.collegeId,
            departmentId: project.departmentId,
            academicYearId: project.academicYearId,
            academicYearLabel: project.academicYearLabel,
            rubricId: rubric._id,
            state: DEFENSE_STATES.SCHEDULED,
            scheduledAt: payload.scheduledAt,
            durationMin: payload.durationMin,
            room: payload.room || undefined,
            meetingLink: payload.meetingLink || undefined,
            committeeId: committee._id,
            chairId: payload.committee.chairId,
            examinerIds,
            supervisorIds: project.supervisorIds || [],
            eligibleMemberIds: project.activeMemberIds || [],
            history: [
              {
                from: DEFENSE_STATES.ELIGIBLE,
                to: DEFENSE_STATES.SCHEDULED,
                event: 'SCHEDULE',
                actorId: actor.id,
                actorRole: getActorRoleName(actor),
              },
            ],
          },
        ],
        { session }
      );
      createdDefense = defense;

      committee.defenseId = defense._id;
      await committee.save({ session });

      await updateProjectDefenseState(
        project._id,
        { defenseState: DEFENSE_STATES.SCHEDULED },
        { session }
      );

      await logTimelineEvent({
        projectId: project._id,
        type: 'defense_scheduled',
        actorId: actor.id,
        refType: 'defense',
        refId: defense._id,
        summaryKey: 'timeline.defenseScheduled',
        data: { scheduledAt: defense.scheduledAt },
        session,
      });

      await recordAudit({
        actorId: actor.id,
        actorRole: getActorRoleName(actor),
        action: 'defense.schedule',
        targetType: 'defense',
        targetId: defense._id,
        scope: { collegeId: project.collegeId, departmentId: project.departmentId, projectId: project._id },
        after: { scheduledAt: defense.scheduledAt, room: defense.room, examinerIds },
        ip,
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  const recipientIds = Array.from(
    new Set([
      ...(project.activeMemberIds || []).map(String),
      ...(project.supervisorIds || []).map(String),
      ...examinerIds,
    ])
  );
  await sendBulkNotifications(
    recipientIds.map((userId) => ({
      userId,
      type: 'defense_scheduled',
      titleKey: 'notifications.defenseScheduledTitle',
      bodyKey: 'notifications.defenseScheduledBody',
      vars: { project: project.title, date: new Date(createdDefense.scheduledAt).toLocaleString('ar-EG') },
      link: `/app/projects/${project._id}`,
    }))
  );

  const userMap = await findUsersBasicByIds(examinerIds);
  return serializeDefense(createdDefense, {
    projectMap: new Map([[String(project._id), project]]),
    userMap,
    committee: createdCommittee,
  });
}

export async function rescheduleDefense(defenseId, payload, { actor, ip }) {
  const defense = await Defense.findById(defenseId);
  if (!defense) throw AppError.notFound();
  if (defense.state !== DEFENSE_STATES.SCHEDULED) {
    throw new AppError('INVALID_TRANSITION');
  }

  const project = await getProjectForEvaluation(defense.projectId);
  let nextExaminerIds = defense.examinerIds.map(String);

  if (payload.committee) {
    const validated = await assertValidCommittee(payload.committee, project);
    nextExaminerIds = validated.examinerIds;
  }

  const nextScheduledAt = payload.scheduledAt ?? defense.scheduledAt;
  const nextDurationMin = payload.durationMin ?? defense.durationMin;
  const nextRoom = payload.room !== undefined ? payload.room : defense.room;

  const conflicts = await findScheduleConflicts({
    excludeDefenseId: defense._id,
    scheduledAt: nextScheduledAt,
    durationMin: nextDurationMin,
    room: nextRoom,
    examinerIds: nextExaminerIds,
  });
  if (conflicts.length > 0 && !payload.acknowledgeConflicts) {
    throw new AppError('CONFLICT', { details: { conflicts } });
  }

  const before = {
    scheduledAt: defense.scheduledAt,
    durationMin: defense.durationMin,
    room: defense.room,
    examinerIds: defense.examinerIds.map(String),
  };

  if (payload.committee) {
    await Committee.findByIdAndUpdate(defense.committeeId, {
      $set: {
        chairId: payload.committee.chairId,
        memberIds: payload.committee.memberIds || [],
        externalExaminerIds: payload.committee.externalExaminerIds || [],
        allExaminerIds: nextExaminerIds,
      },
    });
    defense.chairId = payload.committee.chairId;
    defense.examinerIds = nextExaminerIds;
  }
  defense.scheduledAt = nextScheduledAt;
  defense.durationMin = nextDurationMin;
  if (payload.room !== undefined) defense.room = payload.room;
  if (payload.meetingLink !== undefined) defense.meetingLink = payload.meetingLink;
  defense.history.push({
    from: DEFENSE_STATES.SCHEDULED,
    to: DEFENSE_STATES.SCHEDULED,
    event: 'RESCHEDULE',
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
  });
  await defense.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: getActorRoleName(actor),
    action: 'defense.reschedule',
    targetType: 'defense',
    targetId: defense._id,
    scope: { collegeId: defense.collegeId, departmentId: defense.departmentId, projectId: defense.projectId },
    before,
    after: {
      scheduledAt: defense.scheduledAt,
      durationMin: defense.durationMin,
      room: defense.room,
      examinerIds: nextExaminerIds,
    },
    ip,
  });

  const userMap = await findUsersBasicByIds(nextExaminerIds);
  return serializeDefense(defense, {
    projectMap: new Map([[String(project._id), project]]),
    userMap,
  });
}

export async function listDefenses(scopeFilter, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, ['scheduledAt', '-scheduledAt']);
  const filter = { ...scopeFilter };

  if (query.collegeId) filter.collegeId = query.collegeId;
  if (query.room) filter.room = query.room;
  if (query.examinerId) filter.examinerIds = query.examinerId;
  if (query.from || query.to) {
    const range = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(query.to);
    filter.scheduledAt = mongoose.trusted(range);
  }

  const [docs, total] = await Promise.all([
    Defense.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Defense.countDocuments(filter),
  ]);

  const projectIds = docs.map((d) => d.projectId);
  const examinerIds = docs.flatMap((d) => d.examinerIds || []);
  const [projects, userMap] = await Promise.all([
    Promise.all(projectIds.map((pid) => getProjectForEvaluation(pid).catch(() => null))),
    findUsersBasicByIds(examinerIds),
  ]);

  const projectMap = new Map(projects.filter(Boolean).map((p) => [String(p._id), p]));
  const items = docs.map((d) => serializeDefense(d, { projectMap, userMap }));
  return { items, page: buildPageMeta({ page, limit, total }) };
}

export async function getDefenseById(defenseId) {
  const defense = await Defense.findById(defenseId).lean();
  if (!defense) throw AppError.notFound();

  const [project, committee, rubric, activeScores] = await Promise.all([
    getProjectForEvaluation(defense.projectId),
    Committee.findById(defense.committeeId).lean(),
    Rubric.findById(defense.rubricId).lean(),
    ExaminerScore.find({ defenseId, supersededAt: null })
      .select('examinerId component submittedAt')
      .lean(),
  ]);

  const supId = project.supervision?.primaryId ? String(project.supervision.primaryId) : null;
  const expectedExaminerIds = Array.from(
    new Set([...(defense.examinerIds || []).map(String), ...(supId ? [supId] : [])])
  );
  const userMap = await findUsersBasicByIds(expectedExaminerIds);

  const submittedIds = new Set(
    activeScores.filter((s) => Boolean(s.submittedAt)).map((s) => String(s.examinerId))
  );
  const { collegeMap, departmentMap } = await getCollegesAndDepartmentsMap(
    [defense.collegeId],
    [defense.departmentId]
  );

  // Zero numeric scores returned before finalization (FR-085 / FR-089a)
  return {
    ...serializeDefense(defense, {
      projectMap: new Map([[String(project._id), project]]),
      userMap,
      committee,
    }),
    collegeName: collegeMap.get(String(defense.collegeId))?.name || '',
    departmentName: departmentMap.get(String(defense.departmentId))?.name || '',
    rubric: rubric ? serializeRubric(rubric) : null,
    submittedCount: submittedIds.size,
    totalExaminers: expectedExaminerIds.length,
    supervisorId: supId,
    supervisorName: supId ? userMap.get(supId)?.name || '' : '',
    submissionStatus: expectedExaminerIds.map((id) => ({
      examinerId: id,
      name: userMap.get(id)?.name || '',
      component: id === supId ? 'supervisor' : 'committee',
      submitted: submittedIds.has(id),
    })),
  };
}

export async function inviteExternalExaminer({ defenseId, name }, { actor, ip }) {
  const defense = await Defense.findById(defenseId).select('_id collegeId departmentId state').lean();
  if (!defense) throw AppError.notFound();
  if (defense.state === DEFENSE_STATES.FINALIZED) {
    throw new AppError('INVALID_TRANSITION');
  }

  return createExternalExaminerInvitation({
    defenseId: defense._id,
    collegeId: defense.collegeId,
    departmentId: defense.departmentId,
    name,
    actor,
    ip,
  });
}

export async function attachExternalExaminerToDefense({ defenseId, userId, session }) {
  const defense = await Defense.findById(defenseId).session(session);
  if (!defense || defense.state === DEFENSE_STATES.FINALIZED) {
    throw new AppError('INVITE_UNAVAILABLE');
  }
  const userObjId = new mongoose.Types.ObjectId(userId);
  await Committee.updateOne(
    { _id: defense.committeeId },
    { $addToSet: { externalExaminerIds: userObjId, allExaminerIds: userObjId } },
    { session }
  );
  await Defense.updateOne(
    { _id: defense._id },
    { $addToSet: { examinerIds: userObjId } },
    { session }
  );
}

export async function listActiveExaminersForProject(projectId) {
  const project = await getProjectForEvaluation(projectId);
  const supSet = new Set((project.supervisorIds || []).map(String));
  const candidates = await listActiveExaminersInCollege(project.collegeId);
  return candidates.filter((u) => !supSet.has(u.id));
}
