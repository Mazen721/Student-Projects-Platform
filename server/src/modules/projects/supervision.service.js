import mongoose from 'mongoose';
import {
  PROPOSAL_STATUSES,
  ROLES,
  SUPERVISION_KINDS,
  USER_STATUSES,
} from '@spp/shared/constants';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { findUsersBasicByIds, listSupervisorsInScope } from '../auth/index.js';
import { getAcademicYearInfo, getCollegeAndCurrentYear } from '../organization/index.js';
import Project from './project.model.js';
import SupervisorAssignment from './supervisorAssignment.model.js';
import { getActorRoleName, hydrateProjects, runProjectMembersChangedHooks } from './projectShared.js';

function assertNoSupervisionOverlap({ primaryId, coSupervisorIds, mentorIds }) {
  const coSet = new Set((coSupervisorIds || []).map(String));
  const mentorSet = new Set((mentorIds || []).map(String));

  if (primaryId && (coSet.has(String(primaryId)) || mentorSet.has(String(primaryId)))) {
    throw new AppError('CONFLICT');
  }
  for (const coId of coSet) {
    if (mentorSet.has(coId)) {
      throw new AppError('CONFLICT');
    }
  }
}

async function assertSupervisorsActive(ids, session) {
  const userMap = await findUsersBasicByIds(ids, session);
  for (const id of ids) {
    const user = userMap.get(String(id));
    if (!user || user.status !== USER_STATUSES.ACTIVE) {
      throw AppError.notFound();
    }
  }
}

function canOverrideCap(actor, overrideReason) {
  const hasPrivilege = (actor?.roles || []).some(
    (r) => r.role === ROLES.UNIVERSITY_ADMIN || r.role === ROLES.COLLEGE_ADMIN
  );
  return hasPrivilege && typeof overrideReason === 'string' && overrideReason.trim().length > 0;
}

async function recordSupervisorAssignments(project, nextSupervision, actorId, overrideReason, session) {
  const now = new Date();
  await SupervisorAssignment.updateMany(
    { projectId: project._id, endedAt: null },
    { $set: { endedAt: now } },
    { session }
  );

  const entries = [];
  if (nextSupervision.primaryId) {
    entries.push({
      kind: SUPERVISION_KINDS.PRIMARY,
      supervisorId: nextSupervision.primaryId,
      overrideReason: overrideReason || undefined,
    });
  }
  if (nextSupervision.reviewerId) {
    entries.push({ kind: SUPERVISION_KINDS.REVIEWER, supervisorId: nextSupervision.reviewerId });
  }
  for (const id of nextSupervision.coSupervisorIds || []) {
    entries.push({ kind: SUPERVISION_KINDS.CO, supervisorId: id });
  }
  for (const id of nextSupervision.mentorIds || []) {
    entries.push({ kind: SUPERVISION_KINDS.MENTOR, supervisorId: id });
  }

  if (entries.length > 0) {
    await SupervisorAssignment.insertMany(
      entries.map((e) => ({
        projectId: project._id,
        academicYearId: project.academicYearId,
        collegeId: project.collegeId,
        assignedBy: actorId,
        startedAt: now,
        ...e,
      })),
      { session }
    );
  }
}

export async function assignSupervision(projectId, payload, { actor, ip }) {
  const session = await mongoose.startSession();
  try {
    let updatedProject;
    await session.withTransaction(async () => {
      const project = await Project.findById(projectId).session(session);
      if (!project) throw AppError.notFound();

      const nextPrimary =
        payload.primaryId === undefined ? project.supervision.primaryId : payload.primaryId;
      const nextReviewer =
        payload.reviewerId === undefined ? project.supervision.reviewerId : payload.reviewerId;
      const nextCo = payload.coSupervisorIds ?? project.supervision.coSupervisorIds;
      const nextMentors = payload.mentorIds ?? project.supervision.mentorIds;

      assertNoSupervisionOverlap({
        primaryId: nextPrimary,
        coSupervisorIds: nextCo,
        mentorIds: nextMentors,
      });

      const allIds = [nextPrimary, nextReviewer, ...nextCo, ...nextMentors].filter(Boolean);
      await assertSupervisorsActive(allIds, session);

      const { college } = await getCollegeAndCurrentYear(project.collegeId);
      const cap = college?.settings?.supervisorPrimaryCap || 5;
      let overridden = false;

      if (
        nextPrimary &&
        String(nextPrimary) !== String(project.supervision.primaryId || '')
      ) {
        const primaryCount = await Project.countDocuments({
          _id: mongoose.trusted({ $ne: project._id }),
          academicYearId: project.academicYearId,
          'supervision.primaryId': nextPrimary,
          status: mongoose.trusted({
            $nin: [PROPOSAL_STATUSES.REJECTED, PROPOSAL_STATUSES.WITHDRAWN],
          }),
        }).session(session);

        if (primaryCount >= cap) {
          if (!canOverrideCap(actor, payload.overrideReason)) {
            throw AppError.businessRule('SUPERVISOR_AT_CAPACITY');
          }
          overridden = true;
        }
      }

      const before = { ...project.supervision?.toObject?.() };
      const previousSupIds = new Set((project.supervisorIds || []).map(String));
      project.supervision = {
        primaryId: nextPrimary || null,
        reviewerId: nextReviewer || null,
        coSupervisorIds: nextCo,
        mentorIds: nextMentors,
      };
      await project.save({ session });
      const nextSupSet = new Set((project.supervisorIds || []).map(String));
      const removedSupIds = [...previousSupIds].filter((id) => !nextSupSet.has(id));
      await runProjectMembersChangedHooks(project, { removedUserIds: removedSupIds, session });

      await recordSupervisorAssignments(
        project,
        project.supervision,
        actor.id,
        overridden ? payload.overrideReason : null,
        session
      );

      await recordAudit({
        actorId: actor.id,
        actorRole: getActorRoleName(actor),
        action: overridden ? 'supervision.override' : 'supervision.assign',
        targetType: 'project',
        targetId: project._id,
        scope: {
          collegeId: project.collegeId,
          departmentId: project.departmentId,
          projectId: project._id,
        },
        before,
        after: project.supervision.toObject(),
        reason: overridden ? payload.overrideReason : undefined,
        ip,
        session,
      });

      updatedProject = project;
    });

    const [hydrated] = await hydrateProjects([updatedProject]);
    return hydrated;
  } finally {
    await session.endSession();
  }
}

export async function getSupervisorsLoad(scopeFilter = {}, query = {}) {
  const ay = await getAcademicYearInfo(query.academicYearId);
  if (!ay) throw AppError.notFound();

  const collegeId = query.collegeId || scopeFilter.collegeId || ay.collegeId;
  const [{ college }, supervisors, counts] = await Promise.all([
    getCollegeAndCurrentYear(collegeId),
    listSupervisorsInScope(scopeFilter, { ...query, collegeId }),
    Project.aggregate([
      {
        $match: {
          academicYearId: ay._id,
          status: { $nin: [PROPOSAL_STATUSES.REJECTED, PROPOSAL_STATUSES.WITHDRAWN] },
        },
      },
      {
        $project: {
          primaryId: '$supervision.primaryId',
          coIds: '$supervision.coSupervisorIds',
        },
      },
    ]),
  ]);

  const cap = college?.settings?.supervisorPrimaryCap || 5;
  const primaryMap = new Map();
  const coMap = new Map();

  for (const row of counts) {
    if (row.primaryId) {
      const key = String(row.primaryId);
      primaryMap.set(key, (primaryMap.get(key) || 0) + 1);
    }
    for (const coId of row.coIds || []) {
      const key = String(coId);
      coMap.set(key, (coMap.get(key) || 0) + 1);
    }
  }

  return supervisors.map((sup) => {
    const primaryCount = primaryMap.get(sup.id) || 0;
    const coCount = coMap.get(sup.id) || 0;
    const remaining = Math.max(0, cap - primaryCount);
    return {
      supervisorId: sup.id,
      name: sup.name,
      collegeId: sup.collegeId ? String(sup.collegeId) : null,
      departmentId: sup.departmentId ? String(sup.departmentId) : null,
      primaryCount,
      cap,
      coCount,
      remaining,
      isFull: primaryCount >= cap,
    };
  });
}
