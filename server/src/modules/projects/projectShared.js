import mongoose from 'mongoose';
import {
  PROPOSAL_STATUSES,
  ROLES,
  TEAM_MEMBER_ROLES,
} from '@spp/shared/constants';
import { slugify } from '@spp/shared/text';
import { AppError } from '../../core/errors/AppError.js';
import { findUsersBasicByIds } from '../auth/index.js';
import { getCollegesAndDepartmentsMap } from '../organization/index.js';
import Project from './project.model.js';
import ProjectMembership from './projectMembership.model.js';
import ProposalVersion from './proposalVersion.model.js';

export const ADMIN_ROLES_SET = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

export function getActorRoleName(actor) {
  const roles = Array.isArray(actor?.roles) ? actor.roles : [];
  const admin = roles.find((r) => ADMIN_ROLES_SET.has(r.role));
  return admin?.role || roles[0]?.role || '';
}

export async function generateUniqueSlug(title, session = null) {
  const base = slugify(title, 'project');
  let candidate = base;
  let suffix = 2;
  while (await Project.exists({ slug: candidate }).session(session || null)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function buildProposalSnapshot(project) {
  return {
    title: project.title,
    idea: project.idea,
    problem: project.problem,
    objectives: [...(project.objectives || [])],
    scope: project.scope,
    field: project.field,
    type: project.type,
    beneficiaries: project.beneficiaries,
    keywords: [...(project.keywords || [])],
    expectedOutcomes: project.expectedOutcomes,
    cover: project.cover || null,
    preferredSupervisorId: project.preferredSupervisorId || null,
    ideaId: project.ideaId || null,
  };
}

export async function saveNextProposalVersion(project, authorId, session = null) {
  const latest = await ProposalVersion.findOne({ projectId: project._id })
    .sort({ version: -1 })
    .select('version')
    .session(session || null)
    .lean();
  const nextVersion = (latest?.version || 0) + 1;
  const [created] = await ProposalVersion.create(
    [
      {
        projectId: project._id,
        version: nextVersion,
        snapshot: buildProposalSnapshot(project),
        authorId,
      },
    ],
    session ? { session } : undefined
  );
  return created;
}

export async function assertNoActiveProjectInYear(
  userId,
  academicYearId,
  rule = 'ALREADY_IN_ACTIVE_PROJECT',
  session = null
) {
  const existingMembership = await ProjectMembership.findOne({
    userId,
    academicYearId,
    active: true,
  })
    .select('_id')
    .session(session || null)
    .lean();

  if (existingMembership) {
    throw AppError.businessRule(rule);
  }

  const existingProject = await Project.findOne({
    academicYearId,
    activeMemberIds: userId,
    status: mongoose.trusted({
      $nin: [PROPOSAL_STATUSES.REJECTED, PROPOSAL_STATUSES.WITHDRAWN],
    }),
  })
    .select('_id')
    .session(session || null)
    .lean();

  if (existingProject) {
    throw AppError.businessRule(rule);
  }
}

export async function syncPartnerScopes(project, session = null) {
  const memberIds = (project.activeMemberIds || []).map(String);
  const userMap = await findUsersBasicByIds(memberIds, session);
  const partnerColleges = new Set();
  const partnerDepts = new Set();

  for (const memberId of memberIds) {
    const member = userMap.get(memberId);
    if (!member) continue;
    if (member.collegeId && String(member.collegeId) !== String(project.collegeId)) {
      partnerColleges.add(String(member.collegeId));
    }
    if (member.departmentId && String(member.departmentId) !== String(project.departmentId)) {
      partnerDepts.add(String(member.departmentId));
    }
  }

  project.partnerCollegeIds = Array.from(partnerColleges).map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  project.partnerDepartmentIds = Array.from(partnerDepts).map(
    (id) => new mongoose.Types.ObjectId(id)
  );
}

export function syncActiveMembersArray(project) {
  project.activeMemberIds = (project.team?.members || [])
    .filter((m) => m.status === 'active')
    .map((m) => m.userId);
}

export async function createDraftProjectRecord({
  payload,
  leader,
  academicYear,
  eventName,
  session,
}) {
  await assertNoActiveProjectInYear(
    leader._id,
    academicYear._id,
    'ALREADY_IN_ACTIVE_PROJECT',
    session
  );

  const slug = await generateUniqueSlug(payload.title, session);
  const [project] = await Project.create(
    [
      {
        ...payload,
        slug,
        collegeId: leader.collegeId,
        departmentId: leader.departmentId,
        academicYearId: academicYear._id,
        academicYearLabel: academicYear.label,
        status: PROPOSAL_STATUSES.DRAFT,
        team: {
          leaderId: leader._id,
          members: [
            {
              userId: leader._id,
              role: TEAM_MEMBER_ROLES.LEADER,
              status: 'active',
              joinedAt: new Date(),
            },
          ],
        },
        activeMemberIds: [leader._id],
        history: [
          {
            from: null,
            to: PROPOSAL_STATUSES.DRAFT,
            event: eventName,
            actorId: leader._id,
            actorRole: 'leader',
            at: new Date(),
          },
        ],
      },
    ],
    { session }
  );

  await ProjectMembership.create(
    [
      {
        userId: leader._id,
        academicYearId: academicYear._id,
        projectId: project._id,
        active: true,
      },
    ],
    { session }
  );

  return project;
}

export function normalizeProjectPlain(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  plain.id = String(plain._id);
  plain._id = String(plain._id);
  if (plain.team?.leaderId) plain.team.leaderId = String(plain.team.leaderId);
  if (Array.isArray(plain.activeMemberIds)) {
    plain.activeMemberIds = plain.activeMemberIds.map(String);
  }
  return plain;
}

export async function hydrateProjects(projects = []) {
  if (projects.length === 0) return [];
  const collegeIds = [];
  const departmentIds = [];
  const userIds = [];

  for (const p of projects) {
    collegeIds.push(p.collegeId);
    departmentIds.push(p.departmentId);
    userIds.push(p.team?.leaderId, p.supervision?.primaryId, p.supervision?.reviewerId);
    for (const m of p.team?.members || []) userIds.push(m.userId);
    for (const id of p.supervision?.coSupervisorIds || []) userIds.push(id);
    for (const id of p.supervision?.mentorIds || []) userIds.push(id);
  }

  const [{ collegeMap, departmentMap }, userMap] = await Promise.all([
    getCollegesAndDepartmentsMap(collegeIds, departmentIds),
    findUsersBasicByIds(userIds),
  ]);

  return projects.map((raw) => {
    const p = normalizeProjectPlain(raw);
    const college = collegeMap.get(String(p.collegeId));
    const department = departmentMap.get(String(p.departmentId));
    const primarySup = p.supervision?.primaryId
      ? userMap.get(String(p.supervision.primaryId))
      : null;
    const reviewer = p.supervision?.reviewerId
      ? userMap.get(String(p.supervision.reviewerId))
      : null;

    return {
      ...p,
      college: college ? { id: String(college._id), name: college.name, code: college.code } : null,
      department: department
        ? { id: String(department._id), name: department.name, code: department.code }
        : null,
      supervisor: primarySup
        ? { id: primarySup.id, name: primarySup.name }
        : reviewer
          ? { id: reviewer.id, name: reviewer.name }
          : null,
      teamMembers: (p.team?.members || [])
        .filter((m) => m.status === 'active')
        .map((m) => {
          const u = userMap.get(String(m.userId));
          return {
            userId: String(m.userId),
            role: m.role || TEAM_MEMBER_ROLES.MEMBER,
            joinedAt: m.joinedAt,
            name: u?.name || '',
            studentId: u?.studentId || null,
            collegeId: u?.collegeId ? String(u.collegeId) : null,
            departmentId: u?.departmentId ? String(u.departmentId) : null,
            avatar: u?.avatar || null,
          };
        }),
      supervisionDetails: {
        primary: primarySup ? { id: primarySup.id, name: primarySup.name } : null,
        reviewer: reviewer ? { id: reviewer.id, name: reviewer.name } : null,
        coSupervisors: (p.supervision?.coSupervisorIds || [])
          .map((id) => userMap.get(String(id)))
          .filter(Boolean)
          .map((u) => ({ id: u.id, name: u.name })),
        mentors: (p.supervision?.mentorIds || [])
          .map((id) => userMap.get(String(id)))
          .filter(Boolean)
          .map((u) => ({ id: u.id, name: u.name })),
      },
    };
  });
}
