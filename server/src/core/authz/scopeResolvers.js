import { OBJECT_ID_RE } from '@spp/shared/schemas';
import { t } from '@spp/shared/locales/ar';
import User from '../../modules/auth/user.model.js';
import Invitation from '../../modules/auth/invitation.model.js';
import College from '../../modules/organization/college.model.js';
import Department from '../../modules/organization/department.model.js';
import AcademicYear from '../../modules/organization/academicYear.model.js';
import AdoptionRequest from '../../modules/projects/adoptionRequest.model.js';
import Idea from '../../modules/projects/idea.model.js';
import LeadershipTransfer from '../../modules/projects/leadershipTransfer.model.js';
import Project from '../../modules/projects/project.model.js';
import TeamInvitation from '../../modules/projects/teamInvitation.model.js';
import BOMItem from '../../modules/tracking/bomItem.model.js';
import Meeting from '../../modules/tracking/meeting.model.js';
import PhaseTemplate from '../../modules/tracking/phaseTemplate.model.js';
import Submission from '../../modules/tracking/submission.model.js';
import Task from '../../modules/tracking/task.model.js';
import ToolItem from '../../modules/tracking/toolItem.model.js';
import { hashOpaqueToken } from '../auth/tokens.js';
import { AppError } from '../errors/AppError.js';

const resolverRegistry = new Map();

export function registerScopeResolver(resourceName, resolverFn) {
  resolverRegistry.set(resourceName, resolverFn);
}

function assertObjectId(rawId, paramName = 'id') {
  if (!OBJECT_ID_RE.test(String(rawId || ''))) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: paramName, code: 'validation.invalidObjectId', message: t('validation.invalidObjectId') }],
    });
  }
  return String(rawId);
}

registerScopeResolver('user', async (req) => {
  if (!req.params?.id) {
    return { userId: req.user?.id };
  }
  const id = assertObjectId(req.params.id, 'id');
  const userDoc = await User.findById(id).select('collegeId departmentId').lean();
  if (!userDoc) return null;
  return {
    userId: String(userDoc._id),
    collegeId: userDoc.collegeId,
    departmentId: userDoc.departmentId,
  };
});

registerScopeResolver('college', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const college = await College.findById(id).select('_id').lean();
  if (!college) return null;
  return { collegeId: college._id };
});

registerScopeResolver('department', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const dept = await Department.findById(id).select('collegeId').lean();
  if (!dept) return null;
  return { collegeId: dept.collegeId, departmentId: dept._id };
});

registerScopeResolver('academicYear', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const ay = await AcademicYear.findById(id).select('collegeId').lean();
  if (!ay) return null;
  return { collegeId: ay.collegeId };
});

registerScopeResolver('invitation', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const inv = await Invitation.findById(id).select('collegeId departmentId projectId').lean();
  if (!inv) return null;
  return {
    collegeId: inv.collegeId,
    departmentId: inv.departmentId,
    projectId: inv.projectId,
  };
});

registerScopeResolver('upload', async (req) => {
  const projectId = req.body?.projectId;
  if (projectId && resolverRegistry.has('project')) {
    const projectResolver = resolverRegistry.get('project');
    return projectResolver({ ...req, params: { ...req.params, id: projectId } });
  }
  return { userId: req.user?.id };
});

registerScopeResolver('project', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const project = await Project.findById(id)
    .select(
      'collegeId departmentId partnerCollegeIds partnerDepartmentIds team.leaderId activeMemberIds supervision'
    )
    .lean();
  if (!project) return null;
  return {
    projectId: project._id,
    collegeId: project.collegeId,
    departmentId: project.departmentId,
    partnerCollegeIds: project.partnerCollegeIds || [],
    partnerDepartmentIds: project.partnerDepartmentIds || [],
    leaderId: project.team?.leaderId,
    activeMemberIds: project.activeMemberIds || [],
    supervisorId: project.supervision?.primaryId || null,
    reviewerId: project.supervision?.reviewerId || null,
    coSupervisorIds: project.supervision?.coSupervisorIds || [],
    mentorIds: project.supervision?.mentorIds || [],
  };
});

registerScopeResolver('teamInvitation', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const inv = await TeamInvitation.findById(id)
    .select('inviteeId isLink tokenHash collegeId')
    .lean();
  if (!inv) return null;
  if (inv.inviteeId) {
    return { inviteeId: inv.inviteeId, collegeId: inv.collegeId };
  }
  const token = req.body?.token || req.query?.token;
  const tokenValid = Boolean(inv.isLink && token && hashOpaqueToken(token) === inv.tokenHash);
  return {
    inviteeId: tokenValid ? req.user?.id : null,
    collegeId: inv.collegeId,
  };
});

registerScopeResolver('leadershipTransfer', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const transfer = await LeadershipTransfer.findById(id).select('toUserId').lean();
  if (!transfer) return null;
  return { toUserId: transfer.toUserId };
});

registerScopeResolver('idea', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const idea = await Idea.findById(id).select('ownerId collegeId').lean();
  if (!idea) return null;
  return {
    ownerId: idea.ownerId,
    collegeId: idea.collegeId || null,
  };
});

registerScopeResolver('adoptionRequest', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const adoption = await AdoptionRequest.findById(id).select('ideaId').lean();
  if (!adoption) return null;
  const idea = await Idea.findById(adoption.ideaId).select('ownerId collegeId').lean();
  if (!idea) return null;
  return {
    ownerId: idea.ownerId,
    collegeId: idea.collegeId || null,
  };
});

async function resolveProjectById(req, projectId) {
  const projectResolver = resolverRegistry.get('project');
  return projectResolver({ ...req, params: { ...req.params, id: String(projectId) } });
}

registerScopeResolver('phaseTemplate', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const tpl = await PhaseTemplate.findById(id).select('collegeId').lean();
  if (!tpl) return null;
  return { collegeId: tpl.collegeId };
});

registerScopeResolver('submission', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const sub = await Submission.findById(id).select('projectId').lean();
  if (!sub) return null;
  return resolveProjectById(req, sub.projectId);
});

registerScopeResolver('task', async (req) => {
  const id = assertObjectId(req.params?.taskId || req.params?.id, 'taskId');
  const task = await Task.findById(id).select('projectId').lean();
  if (!task) return null;
  return resolveProjectById(req, task.projectId);
});

registerScopeResolver('bomItem', async (req) => {
  const id = assertObjectId(req.params?.itemId || req.params?.id, 'itemId');
  const item = await BOMItem.findById(id).select('projectId').lean();
  if (!item) return null;
  return resolveProjectById(req, item.projectId);
});

registerScopeResolver('toolItem', async (req) => {
  const id = assertObjectId(req.params?.toolId || req.params?.id, 'toolId');
  const tool = await ToolItem.findById(id).select('projectId').lean();
  if (!tool) return null;
  return resolveProjectById(req, tool.projectId);
});

registerScopeResolver('meeting', async (req) => {
  const id = assertObjectId(req.params?.meetingId || req.params?.id, 'meetingId');
  const meeting = await Meeting.findById(id).select('projectId').lean();
  if (!meeting) return null;
  return resolveProjectById(req, meeting.projectId);
});

export async function resolveResourceScope(resource, req) {
  if (resource === 'self' || resource === 'university' || resource === 'scope') {
    return { isCollectionLevel: true, scope: {} };
  }
  const resolver = resolverRegistry.get(resource);
  if (!resolver) {
    throw new Error(`Missing scope resolver for resource "${resource}"`);
  }
  const scope = await resolver(req);
  return {
    isCollectionLevel: resource === 'user' && !req.params?.id,
    scope,
  };
}
