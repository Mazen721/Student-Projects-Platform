import mongoose from 'mongoose';
import { PHASE_TEMPLATE_STATUSES, WEIGHT_TOLERANCE } from '@spp/shared/constants';
import { computeProgress } from '@spp/shared/calc';
import { t } from '@spp/shared/locales/ar';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { verifyUpload } from '../../core/uploads/verifyUpload.js';
import { getProjectForTracking, updateProjectProgress } from '../projects/index.js';
import Deliverable from './deliverable.model.js';
import PhaseTemplate from './phaseTemplate.model.js';
import ProjectPhase from './projectPhase.model.js';
import { logTimelineEvent } from './timeline.service.js';

const DEFENSE_LOCKED_STATES = new Set([
  'scheduled',
  'grading',
  'deliberation',
  'finalized',
  'reevaluation_requested',
  'reevaluation_open',
]);

export function getActorRoleName(actor) {
  const roles = Array.isArray(actor?.roles) ? actor.roles : [];
  return roles[0]?.role || '';
}

export function assertDefenseNotScheduled(defenseState) {
  if (DEFENSE_LOCKED_STATES.has(defenseState)) {
    throw new AppError('DEFENSE_ALREADY_SCHEDULED');
  }
}

function assertWeightsSumTo100(phases = []) {
  const sum = phases.reduce((acc, p) => acc + Number(p.weight || 0), 0);
  if (Math.abs(sum - 100) > WEIGHT_TOLERANCE) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'phases', code: 'validation.weightsSum100', message: t('validation.weightsSum100') }],
    });
  }
}

async function verifyPhaseForms(phases, userId) {
  const verified = [];
  for (const phase of phases) {
    const verifiedForms = [];
    for (const form of phase.forms || []) {
      const ref = await verifyUpload(form, { userId, expectedPurpose: 'form' });
      verifiedForms.push(ref);
    }
    verified.push({ ...phase, forms: verifiedForms });
  }
  return verified;
}

function serializeTemplate(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...plain,
    id: String(plain._id),
    collegeId: String(plain.collegeId),
  };
}

export async function listPhaseTemplates(collegeId) {
  const docs = await PhaseTemplate.find({ collegeId })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();
  return docs.map(serializeTemplate);
}

export async function createPhaseTemplate(collegeId, payload, { actor, ip }) {
  assertWeightsSumTo100(payload.phases);
  const phasesWithVerifiedForms = await verifyPhaseForms(payload.phases, actor.id);

  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      if (payload.isDefault !== false) {
        await PhaseTemplate.updateMany(
          { collegeId, status: PHASE_TEMPLATE_STATUSES.ACTIVE, isDefault: true },
          { $set: { isDefault: false } },
          { session }
        );
      }
      const [doc] = await PhaseTemplate.create(
        [
          {
            collegeId,
            name: payload.name,
            isDefault: payload.isDefault ?? true,
            phases: phasesWithVerifiedForms,
          },
        ],
        { session }
      );
      created = doc;

      await recordAudit({
        actorId: actor.id,
        actorRole: getActorRoleName(actor),
        action: 'phaseTemplate.create',
        targetType: 'phaseTemplate',
        targetId: doc._id,
        scope: { collegeId },
        after: { name: doc.name, isDefault: doc.isDefault },
        ip,
        session,
      });
    });

    return serializeTemplate(created);
  } finally {
    await session.endSession();
  }
}

export async function updatePhaseTemplate(templateId, payload, { actor, ip }) {
  const existing = await PhaseTemplate.findById(templateId);
  if (!existing) {
    throw AppError.notFound();
  }

  let verifiedPhases = null;
  if (payload.phases) {
    assertWeightsSumTo100(payload.phases);
    verifiedPhases = await verifyPhaseForms(payload.phases, actor.id);
  }

  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const doc = await PhaseTemplate.findById(templateId).session(session);
      const before = { name: doc.name, isDefault: doc.isDefault, status: doc.status };

      if (payload.isDefault === true) {
        await PhaseTemplate.updateMany(
          { collegeId: doc.collegeId, _id: { $ne: doc._id }, isDefault: true },
          { $set: { isDefault: false } },
          { session }
        );
      }
      if (payload.name !== undefined) doc.name = payload.name;
      if (payload.isDefault !== undefined) doc.isDefault = payload.isDefault;
      if (verifiedPhases) doc.phases = verifiedPhases;

      await doc.save({ session });
      updated = doc;

      await recordAudit({
        actorId: actor.id,
        actorRole: getActorRoleName(actor),
        action: 'phaseTemplate.update',
        targetType: 'phaseTemplate',
        targetId: doc._id,
        scope: { collegeId: doc.collegeId },
        before,
        after: { name: doc.name, isDefault: doc.isDefault, status: doc.status },
        ip,
        session,
      });
    });

    return serializeTemplate(updated);
  } finally {
    await session.endSession();
  }
}

function resolvePhaseDueDate(phaseDef, baseDate) {
  if (phaseDef.dueDate) return new Date(phaseDef.dueDate);
  const offsetDays = Number(phaseDef.dueOffsetDays || 30);
  return new Date(baseDate.getTime() + offsetDays * 86400000);
}

export async function copyPhaseTemplateToProject(project, { session }) {
  const existingCount = await ProjectPhase.countDocuments({ projectId: project._id }).session(session);
  if (existingCount > 0) return;

  const template = await PhaseTemplate.findOne({
    collegeId: project.collegeId,
    status: PHASE_TEMPLATE_STATUSES.ACTIVE,
  })
    .sort({ isDefault: -1, createdAt: -1 })
    .session(session)
    .lean();

  if (!template) {
    throw new AppError('NO_ACTIVE_PHASE_TEMPLATE');
  }

  const baseDate = new Date();
  const sortedPhases = [...(template.phases || [])].sort((a, b) => a.order - b.order);
  const phasesWithDeliverables = [];

  for (const phaseDef of sortedPhases) {
    const dueDate = resolvePhaseDueDate(phaseDef, baseDate);
    const reqList = phaseDef.requiredDeliverables || [];
    const [phaseDoc] = await ProjectPhase.create(
      [
        {
          projectId: project._id,
          collegeId: project.collegeId,
          departmentId: project.departmentId,
          academicYearId: project.academicYearId,
          templateId: template._id,
          key: phaseDef.key,
          name: phaseDef.name,
          order: phaseDef.order,
          weight: phaseDef.weight,
          dueDate,
          forms: phaseDef.forms || [],
          requiredCount: reqList.length,
        },
      ],
      { session }
    );

    const createdDeliverables = [];
    if (reqList.length > 0) {
      const delivDocs = await Deliverable.insertMany(
        reqList.map((d) => ({
          projectId: project._id,
          phaseId: phaseDoc._id,
          collegeId: project.collegeId,
          departmentId: project.departmentId,
          academicYearId: project.academicYearId,
          key: d.key,
          title: d.title,
          description: d.description,
          allowedTypes: d.allowedTypes || [],
          required: true,
          dueDate,
        })),
        { session }
      );
      createdDeliverables.push(...delivDocs);
    }

    phasesWithDeliverables.push({
      id: phaseDoc._id,
      weight: phaseDoc.weight,
      completedBySupervisor: null,
      deliverables: createdDeliverables,
    });
  }

  const progress = computeProgress(phasesWithDeliverables);
  await updateProjectProgress(project._id, progress, { session });
}

export async function recalculateProjectProgress(
  projectId,
  { regressDefenseIfEligible = false, session = null } = {}
) {
  const phaseQuery = ProjectPhase.find({ projectId }).sort({ order: 1 });
  const delivQuery = Deliverable.find({ projectId });
  if (session) {
    phaseQuery.session(session);
    delivQuery.session(session);
  }
  const [phases, deliverables] = await Promise.all([phaseQuery.lean(), delivQuery.lean()]);

  const delivsByPhase = new Map();
  for (const d of deliverables) {
    const pid = String(d.phaseId);
    if (!delivsByPhase.has(pid)) delivsByPhase.set(pid, []);
    delivsByPhase.get(pid).push(d);
  }

  const progress = computeProgress(
    phases.map((p) => ({
      id: p._id,
      weight: p.weight,
      completedBySupervisor: p.completedBySupervisor,
      deliverables: delivsByPhase.get(String(p._id)) || [],
    }))
  );

  await updateProjectProgress(projectId, progress, { regressDefenseIfEligible, session });
  return progress;
}

export async function getProjectPhases(projectId) {
  await getProjectForTracking(projectId);
  const [phases, deliverables] = await Promise.all([
    ProjectPhase.find({ projectId }).sort({ order: 1 }).lean(),
    Deliverable.find({ projectId }).sort({ createdAt: 1 }).lean(),
  ]);

  const delivsByPhase = new Map();
  for (const d of deliverables) {
    const pid = String(d.phaseId);
    if (!delivsByPhase.has(pid)) delivsByPhase.set(pid, []);
    delivsByPhase.get(pid).push({
      ...d,
      id: String(d._id),
      phaseId: pid,
      projectId: String(d.projectId),
      latestSubmissionId: d.latestSubmissionId ? String(d.latestSubmissionId) : null,
    });
  }

  const phasesWithDeliverables = phases.map((p) => ({
    ...p,
    id: String(p._id),
    projectId: String(p.projectId),
    deliverables: delivsByPhase.get(String(p._id)) || [],
  }));

  const progress = computeProgress(phasesWithDeliverables);
  const pctByPhase = new Map(progress.perPhase.map((item) => [String(item.phaseId), item.percent]));

  return {
    phases: phasesWithDeliverables.map((p) => ({
      ...p,
      percent: pctByPhase.get(p.id) ?? 0,
    })),
    progress: {
      percent: progress.percent,
      perPhase: progress.perPhase.map((entry) => ({
        phaseId: String(entry.phaseId),
        percent: entry.percent,
      })),
    },
  };
}

export async function adjustPhase(projectId, phaseId, { dueDate }, { actor }) {
  await getProjectForTracking(projectId, { requireWritable: true });
  const phase = await ProjectPhase.findOneAndUpdate(
    { _id: phaseId, projectId },
    { $set: { dueDate } },
    { new: true }
  ).lean();
  if (!phase) {
    throw AppError.notFound();
  }

  await Deliverable.updateMany({ projectId, phaseId }, { $set: { dueDate } });
  await logTimelineEvent({
    projectId,
    type: 'phase_adjusted',
    actorId: actor.id,
    refType: 'phase',
    refId: phase._id,
    summaryKey: 'timeline.phaseAdjusted',
    data: { name: phase.name, dueDate },
  });

  return { ...phase, id: String(phase._id) };
}

export async function markZeroDeliverablePhaseComplete(projectId, phaseId, { actor }) {
  await getProjectForTracking(projectId, { requireWritable: true });
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const phase = await ProjectPhase.findOne({ _id: phaseId, projectId }).session(session);
      if (!phase) throw AppError.notFound();

      const reqCount = await Deliverable.countDocuments({
        projectId,
        phaseId,
        required: true,
      }).session(session);
      if (reqCount > 0) {
        throw AppError.businessRule('PHASE_HAS_DELIVERABLES');
      }

      phase.completedBySupervisor = { by: actor.id, at: new Date() };
      await phase.save({ session });

      const progress = await recalculateProjectProgress(projectId, { session });
      await logTimelineEvent({
        projectId,
        type: 'phase_completed',
        actorId: actor.id,
        refType: 'phase',
        refId: phase._id,
        summaryKey: 'timeline.phaseCompleted',
        data: { name: phase.name },
        session,
      });
      result = { phaseId: String(phase._id), progress };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function reopenZeroDeliverablePhase(projectId, phaseId, { reason }, { actor }) {
  const project = await getProjectForTracking(projectId, { requireWritable: true });
  assertDefenseNotScheduled(project.defenseState);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const phase = await ProjectPhase.findOne({ _id: phaseId, projectId }).session(session);
      if (!phase) throw AppError.notFound();

      phase.completedBySupervisor = null;
      await phase.save({ session });

      const progress = await recalculateProjectProgress(projectId, {
        regressDefenseIfEligible: true,
        session,
      });
      await logTimelineEvent({
        projectId,
        type: 'phase_reopened',
        actorId: actor.id,
        refType: 'phase',
        refId: phase._id,
        summaryKey: 'timeline.phaseReopened',
        data: { name: phase.name, reason },
        session,
      });
      result = { phaseId: String(phase._id), progress };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function addPhaseMilestone(projectId, phaseId, { title, dueDate }) {
  await getProjectForTracking(projectId, { requireWritable: true });
  const phase = await ProjectPhase.findOneAndUpdate(
    { _id: phaseId, projectId },
    { $push: { milestones: { title, dueDate, done: false } } },
    { new: true }
  ).lean();
  if (!phase) {
    throw AppError.notFound();
  }
  const added = phase.milestones[phase.milestones.length - 1];
  return { ...added, id: String(added._id) };
}

export async function checkProjectPhasesEligibility(projectId, { session = null } = {}) {
  const phaseQuery = ProjectPhase.find({ projectId }).sort({ order: 1 });
  const delivQuery = Deliverable.find({
    projectId,
    required: mongoose.trusted({ $ne: false }),
  });
  if (session) {
    phaseQuery.session(session);
    delivQuery.session(session);
  }
  const [phases, requiredDeliverables] = await Promise.all([phaseQuery.lean(), delivQuery.lean()]);

  if (phases.length === 0) {
    return { allPhasesApproved: false, missingPhases: [] };
  }

  const delivsByPhase = new Map();
  for (const d of requiredDeliverables) {
    const pid = String(d.phaseId);
    if (!delivsByPhase.has(pid)) delivsByPhase.set(pid, []);
    delivsByPhase.get(pid).push(d);
  }

  const missingPhases = [];
  for (const phase of phases) {
    const reqs = delivsByPhase.get(String(phase._id)) || [];
    if (reqs.length === 0) {
      if (!phase.completedBySupervisor) {
        missingPhases.push({
          phaseId: String(phase._id),
          name: phase.name,
          pendingCount: 1,
        });
      }
      continue;
    }
    const pendingCount = reqs.filter((d) => d.latestStatus !== 'approved').length;
    if (pendingCount > 0) {
      missingPhases.push({
        phaseId: String(phase._id),
        name: phase.name,
        pendingCount,
      });
    }
  }

  return {
    allPhasesApproved: missingPhases.length === 0,
    missingPhases,
  };
}
