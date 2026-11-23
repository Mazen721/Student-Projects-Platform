import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  INVITE_EXPIRY_DAYS,
  PROPOSAL_STATUSES,
  TEAM_INVITATION_STATUSES,
  TEAM_MEMBER_ROLES,
  TRANSFER_STATUSES,
  USER_STATUSES,
} from '@spp/shared/constants';
import { recordAudit } from '../../core/audit/audit.service.js';
import { hashOpaqueToken } from '../../core/auth/tokens.js';
import { AppError } from '../../core/errors/AppError.js';
import { sendNotification } from '../../core/notifications/notify.service.js';
import { findUserBasicById, findUsersBasicByIds } from '../auth/index.js';
import { getCollegeAndCurrentYear } from '../organization/index.js';
import LeadershipTransfer from './leadershipTransfer.model.js';
import Project from './project.model.js';
import ProjectMembership from './projectMembership.model.js';
import TeamInvitation from './teamInvitation.model.js';
import {
  ADMIN_ROLES_SET,
  assertNoActiveProjectInYear,
  getActorRoleName,
  hydrateProjects,
  syncActiveMembersArray,
  syncPartnerScopes,
} from './projectShared.js';

const PRE_APPROVAL_STATUSES = new Set([
  PROPOSAL_STATUSES.DRAFT,
  PROPOSAL_STATUSES.SUBMITTED,
  PROPOSAL_STATUSES.UNDER_REVIEW,
  PROPOSAL_STATUSES.NEEDS_CHANGES,
  PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED,
]);

function assertTeamEditable(project) {
  if ([PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.ARCHIVED].includes(project.status)) {
    throw AppError.businessRule('LOCKED_AFTER_APPROVAL');
  }
  if ([PROPOSAL_STATUSES.REJECTED, PROPOSAL_STATUSES.WITHDRAWN].includes(project.status)) {
    throw new AppError('INVALID_TRANSITION');
  }
}

export async function inviteTeammate(projectId, { inviteeId, link }, { actor }) {
  const project = await Project.findById(projectId);
  if (!project) throw AppError.notFound();
  assertTeamEditable(project);

  const { college } = await getCollegeAndCurrentYear(project.collegeId);
  const maxTeam = college?.settings?.teamSizeMax || 5;
  if ((project.activeMemberIds || []).length >= maxTeam) {
    throw AppError.businessRule('TEAM_FULL');
  }

  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  if (link) {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const inv = await TeamInvitation.create({
      projectId: project._id,
      collegeId: project.collegeId,
      isLink: true,
      tokenHash: hashOpaqueToken(rawToken),
      invitedBy: actor.id,
      expiresAt,
    });
    return {
      ...inv.toObject(),
      _id: String(inv._id),
      url: `/app/projects/invite/${inv._id}?token=${rawToken}`,
    };
  }

  const invitee = await findUserBasicById(inviteeId);
  if (!invitee || invitee.status !== USER_STATUSES.ACTIVE || invitee.accountType !== 'student') {
    throw AppError.notFound();
  }
  if (!college?.settings?.allowCrossCollege && String(invitee.collegeId) !== String(project.collegeId)) {
    throw AppError.businessRule('CROSS_COLLEGE_NOT_ALLOWED');
  }

  await assertNoActiveProjectInYear(
    invitee._id,
    project.academicYearId,
    'INVITEE_IN_ACTIVE_PROJECT'
  );

  const duplicate = await TeamInvitation.findOne({
    projectId: project._id,
    inviteeId: invitee._id,
    status: TEAM_INVITATION_STATUSES.PENDING,
    expiresAt: mongoose.trusted({ $gt: new Date() }),
  }).lean();
  if (duplicate) {
    throw new AppError('CONFLICT');
  }

  const inv = await TeamInvitation.create({
    projectId: project._id,
    collegeId: project.collegeId,
    inviteeId: invitee._id,
    invitedBy: actor.id,
    expiresAt,
  });

  await sendNotification({
    userId: invitee._id,
    type: 'team_invitation',
    titleKey: 'projects.team',
    bodyKey: 'timeline.proposalCreated',
    vars: { title: project.title },
    link: `/app/projects`,
  });

  return { ...inv.toObject(), _id: String(inv._id) };
}

export async function listMyTeamInvitations(userId) {
  const invitations = await TeamInvitation.find({
    inviteeId: userId,
    status: TEAM_INVITATION_STATUSES.PENDING,
    expiresAt: mongoose.trusted({ $gt: new Date() }),
  })
    .sort({ createdAt: -1 })
    .lean();

  if (invitations.length === 0) return [];
  const projectIds = invitations.map((i) => i.projectId);
  const inviterIds = invitations.map((i) => i.invitedBy);

  const [projects, userMap] = await Promise.all([
    Project.find({ _id: mongoose.trusted({ $in: projectIds }) }).select('title status collegeId').lean(),
    findUsersBasicByIds(inviterIds),
  ]);
  const projectMap = new Map(projects.map((p) => [String(p._id), p]));

  return invitations.map((inv) => ({
    ...inv,
    _id: String(inv._id),
    id: String(inv._id),
    project: projectMap.get(String(inv.projectId)) || null,
    invitedByUser: userMap.get(String(inv.invitedBy)) || null,
  }));
}

export async function respondTeamInvitation(invitationId, decision, { actor }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const inv = await TeamInvitation.findOne({
        _id: invitationId,
        status: TEAM_INVITATION_STATUSES.PENDING,
        expiresAt: mongoose.trusted({ $gt: new Date() }),
      }).session(session);
      if (!inv) {
        throw AppError.notFound();
      }

      if (decision === 'decline') {
        inv.status = TEAM_INVITATION_STATUSES.DECLINED;
        inv.respondedAt = new Date();
        inv.respondedBy = actor.id;
        await inv.save({ session });
        result = { status: inv.status };
        return;
      }

      const project = await Project.findById(inv.projectId).session(session);
      if (!project) throw AppError.notFound();
      assertTeamEditable(project);

      const [{ college }, joiner] = await Promise.all([
        getCollegeAndCurrentYear(project.collegeId),
        findUserBasicById(actor.id, session),
      ]);
      if (!joiner || joiner.status !== USER_STATUSES.ACTIVE) {
        throw AppError.forbidden();
      }
      if ((project.activeMemberIds || []).length >= (college?.settings?.teamSizeMax || 5)) {
        throw AppError.businessRule('TEAM_FULL');
      }
      if (
        !college?.settings?.allowCrossCollege &&
        String(joiner.collegeId) !== String(project.collegeId)
      ) {
        throw AppError.businessRule('CROSS_COLLEGE_NOT_ALLOWED');
      }

      await assertNoActiveProjectInYear(
        joiner._id,
        project.academicYearId,
        'ALREADY_IN_ACTIVE_PROJECT',
        session
      );

      await ProjectMembership.create(
        [
          {
            userId: joiner._id,
            academicYearId: project.academicYearId,
            projectId: project._id,
            active: true,
          },
        ],
        { session }
      );

      const existingEntry = project.team.members.find(
        (m) => String(m.userId) === String(joiner._id)
      );
      if (existingEntry) {
        existingEntry.status = 'active';
        existingEntry.role = TEAM_MEMBER_ROLES.MEMBER;
        existingEntry.joinedAt = new Date();
        existingEntry.leftAt = undefined;
      } else {
        project.team.members.push({
          userId: joiner._id,
          role: TEAM_MEMBER_ROLES.MEMBER,
          status: 'active',
          joinedAt: new Date(),
        });
      }
      syncActiveMembersArray(project);
      await syncPartnerScopes(project, session);
      await project.save({ session });

      inv.status = TEAM_INVITATION_STATUSES.ACCEPTED;
      inv.respondedAt = new Date();
      inv.respondedBy = joiner._id;
      await inv.save({ session });

      result = { status: inv.status, projectId: String(project._id) };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function promoteNextLeaderIfNeeded(project, removedUserId) {
  if (String(project.team.leaderId) !== String(removedUserId)) return;
  const nextMember = project.team.members.find(
    (m) => m.status === 'active' && String(m.userId) !== String(removedUserId)
  );
  if (nextMember) {
    nextMember.role = TEAM_MEMBER_ROLES.LEADER;
    project.team.leaderId = nextMember.userId;
  }
}

export async function removeTeamMember(projectId, targetUserId, { reason }, { actor, ip }) {
  const session = await mongoose.startSession();
  try {
    let updatedProject;
    await session.withTransaction(async () => {
      const project = await Project.findById(projectId).session(session);
      if (!project) throw AppError.notFound();

      const actorIsAdmin = ADMIN_ROLES_SET.has(getActorRoleName(actor));
      if (!PRE_APPROVAL_STATUSES.has(project.status) && !actorIsAdmin) {
        throw AppError.businessRule('LOCKED_AFTER_APPROVAL');
      }
      if (!actorIsAdmin && String(targetUserId) === String(project.team.leaderId)) {
        throw new AppError('INVALID_TRANSITION');
      }

      const member = project.team.members.find(
        (m) => m.status === 'active' && String(m.userId) === String(targetUserId)
      );
      if (!member) throw AppError.notFound();

      member.status = 'removed';
      member.leftAt = new Date();
      member.removedBy = actor.id;
      promoteNextLeaderIfNeeded(project, targetUserId);
      syncActiveMembersArray(project);
      await syncPartnerScopes(project, session);
      await project.save({ session });

      await ProjectMembership.updateOne(
        { userId: targetUserId, academicYearId: project.academicYearId, projectId: project._id, active: true },
        { $set: { active: false } },
        { session }
      );

      if (actorIsAdmin) {
        await recordAudit({
          actorId: actor.id,
          actorRole: getActorRoleName(actor),
          action: 'team.removeMember',
          targetType: 'project',
          targetId: project._id,
          scope: { collegeId: project.collegeId, departmentId: project.departmentId, projectId: project._id },
          after: { removedUserId: String(targetUserId) },
          reason,
          ip,
          session,
        });
      }

      updatedProject = project;
    });
    const [hydrated] = await hydrateProjects([updatedProject]);
    return hydrated;
  } finally {
    await session.endSession();
  }
}

export async function leaveTeam(projectId, { actor }) {
  const session = await mongoose.startSession();
  try {
    let updatedProject;
    await session.withTransaction(async () => {
      const project = await Project.findById(projectId).session(session);
      if (!project) throw AppError.notFound();
      if (!PRE_APPROVAL_STATUSES.has(project.status)) {
        throw AppError.businessRule('LOCKED_AFTER_APPROVAL');
      }
      if (String(project.team.leaderId) === String(actor.id)) {
        throw new AppError('INVALID_TRANSITION');
      }

      const member = project.team.members.find(
        (m) => m.status === 'active' && String(m.userId) === String(actor.id)
      );
      if (!member) throw AppError.notFound();

      member.status = 'left';
      member.leftAt = new Date();
      syncActiveMembersArray(project);
      await syncPartnerScopes(project, session);
      await project.save({ session });

      await ProjectMembership.updateOne(
        { userId: actor.id, academicYearId: project.academicYearId, projectId: project._id, active: true },
        { $set: { active: false } },
        { session }
      );
      updatedProject = project;
    });
    const [hydrated] = await hydrateProjects([updatedProject]);
    return hydrated;
  } finally {
    await session.endSession();
  }
}

export async function moveTeamMember(projectId, { userId, targetProjectId, reason }, { actor, ip }) {
  if (String(projectId) === String(targetProjectId)) {
    throw new AppError('CONFLICT');
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [source, target] = await Promise.all([
        Project.findById(projectId).session(session),
        Project.findById(targetProjectId).session(session),
      ]);
      if (!source || !target) throw AppError.notFound();
      if (String(source.academicYearId) !== String(target.academicYearId)) {
        throw new AppError('CONFLICT');
      }

      const { college: targetCollege } = await getCollegeAndCurrentYear(target.collegeId);
      if ((target.activeMemberIds || []).length >= (targetCollege?.settings?.teamSizeMax || 5)) {
        throw AppError.businessRule('TEAM_FULL');
      }

      const member = source.team.members.find(
        (m) => m.status === 'active' && String(m.userId) === String(userId)
      );
      if (!member) throw AppError.notFound();

      member.status = 'removed';
      member.leftAt = new Date();
      member.removedBy = actor.id;
      promoteNextLeaderIfNeeded(source, userId);
      syncActiveMembersArray(source);
      await syncPartnerScopes(source, session);
      await source.save({ session });

      target.team.members.push({
        userId,
        role: TEAM_MEMBER_ROLES.MEMBER,
        status: 'active',
        joinedAt: new Date(),
      });
      syncActiveMembersArray(target);
      await syncPartnerScopes(target, session);
      await target.save({ session });

      await ProjectMembership.updateOne(
        { userId, academicYearId: source.academicYearId, active: true },
        { $set: { projectId: target._id } },
        { session }
      );

      await recordAudit({
        actorId: actor.id,
        actorRole: getActorRoleName(actor),
        action: 'team.moveMember',
        targetType: 'project',
        targetId: source._id,
        scope: { collegeId: source.collegeId, departmentId: source.departmentId, projectId: source._id },
        after: { userId: String(userId), targetProjectId: String(target._id) },
        reason,
        ip,
        session,
      });
    });
    return { moved: true };
  } finally {
    await session.endSession();
  }
}

function applyLeadershipSwap(project, toUserId, actorId, actorRole) {
  const previousLeaderId = project.team.leaderId;
  for (const m of project.team.members) {
    if (m.status !== 'active') continue;
    if (String(m.userId) === String(toUserId)) {
      m.role = TEAM_MEMBER_ROLES.LEADER;
    } else if (String(m.userId) === String(previousLeaderId)) {
      m.role = TEAM_MEMBER_ROLES.MEMBER;
    }
  }
  project.team.leaderId = toUserId;
  project.history.push({
    from: project.status,
    to: project.status,
    event: 'LEADERSHIP_TRANSFER',
    actorId,
    actorRole,
    at: new Date(),
  });
}

export async function requestLeadershipTransfer(projectId, { toUserId }, { actor }) {
  const project = await Project.findById(projectId);
  if (!project) throw AppError.notFound();
  if ([PROPOSAL_STATUSES.REJECTED, PROPOSAL_STATUSES.WITHDRAWN, PROPOSAL_STATUSES.ARCHIVED].includes(project.status)) {
    throw new AppError('INVALID_TRANSITION');
  }

  const isMember = (project.activeMemberIds || []).some((id) => String(id) === String(toUserId));
  if (!isMember || String(project.team.leaderId) === String(toUserId)) {
    throw AppError.notFound();
  }

  const actorIsAdmin = ADMIN_ROLES_SET.has(getActorRoleName(actor));
  if (actorIsAdmin) {
    applyLeadershipSwap(project, toUserId, actor.id, getActorRoleName(actor));
    await project.save();
    const [hydrated] = await hydrateProjects([project]);
    return { immediate: true, project: hydrated };
  }

  const transfer = await LeadershipTransfer.create({
    projectId: project._id,
    fromUserId: project.team.leaderId,
    toUserId,
    initiatedBy: actor.id,
  });

  await sendNotification({
    userId: toUserId,
    type: 'leadership_transfer',
    titleKey: 'projects.team',
    bodyKey: 'timeline.proposalCreated',
    vars: { title: project.title },
    link: `/app/projects/${project._id}`,
  });

  return { ...transfer.toObject(), _id: String(transfer._id) };
}

export async function respondLeadershipTransfer(transferId, decision, { actor }) {
  const session = await mongoose.startSession();
  try {
    let outcome;
    await session.withTransaction(async () => {
      const transfer = await LeadershipTransfer.findOne({
        _id: transferId,
        status: TRANSFER_STATUSES.PENDING,
      }).session(session);
      if (!transfer) throw AppError.notFound();

      if (decision === 'decline') {
        transfer.status = TRANSFER_STATUSES.DECLINED;
        transfer.respondedAt = new Date();
        await transfer.save({ session });
        outcome = { status: transfer.status };
        return;
      }

      const project = await Project.findById(transfer.projectId).session(session);
      if (!project) throw AppError.notFound();

      applyLeadershipSwap(project, transfer.toUserId, actor.id, 'member');
      await project.save({ session });

      transfer.status = TRANSFER_STATUSES.ACCEPTED;
      transfer.respondedAt = new Date();
      await transfer.save({ session });

      await LeadershipTransfer.updateMany(
        {
          projectId: project._id,
          status: TRANSFER_STATUSES.PENDING,
          _id: mongoose.trusted({ $ne: transfer._id }),
        },
        { $set: { status: TRANSFER_STATUSES.CANCELLED, respondedAt: new Date() } },
        { session }
      );

      const [hydrated] = await hydrateProjects([project]);
      outcome = hydrated;
    });
    return outcome;
  } finally {
    await session.endSession();
  }
}

export async function removeImpostorMemberships(userId, session, actorId) {
  await ProjectMembership.updateMany(
    { userId, active: true },
    { $set: { active: false } },
    { session }
  );

  const projects = await Project.find({ activeMemberIds: userId }).session(session);
  for (const project of projects) {
    for (const member of project.team.members) {
      if (member.status === 'active' && String(member.userId) === String(userId)) {
        member.status = 'removed';
        member.leftAt = new Date();
        member.removedBy = actorId;
      }
    }
    promoteNextLeaderIfNeeded(project, userId);
    syncActiveMembersArray(project);
    await syncPartnerScopes(project, session);
    await project.save({ session });
  }
}
