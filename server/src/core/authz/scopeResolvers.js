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
import Deliverable from '../../modules/tracking/deliverable.model.js';
import Meeting from '../../modules/tracking/meeting.model.js';
import PhaseTemplate from '../../modules/tracking/phaseTemplate.model.js';
import Submission from '../../modules/tracking/submission.model.js';
import Task from '../../modules/tracking/task.model.js';
import ToolItem from '../../modules/tracking/toolItem.model.js';
import Channel from '../../modules/collaboration/channel.model.js';
import Comment from '../../modules/collaboration/comment.model.js';
import MediaAlbum from '../../modules/collaboration/mediaAlbum.model.js';
import MediaItem from '../../modules/collaboration/mediaItem.model.js';
import Message from '../../modules/collaboration/message.model.js';
import Defense from '../../modules/evaluation/defense.model.js';
import ReEvaluationRequest from '../../modules/evaluation/reevaluationRequest.model.js';
import Rubric from '../../modules/evaluation/rubric.model.js';
import Challenge from '../../modules/showcase/challenge.model.js';
import Competition from '../../modules/showcase/competition.model.js';
import ContactRequest from '../../modules/showcase/contactRequest.model.js';
import PublicComment from '../../modules/showcase/publicComment.model.js';
import Vote from '../../modules/showcase/vote.model.js';
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

registerScopeResolver('channel', async (req) => {
  const id = assertObjectId(req.params?.channelId || req.params?.id, 'channelId');
  const channel = await Channel.findById(id)
    .select('kind projectId memberIds collegeId departmentId')
    .lean();
  if (!channel) return null;
  const projectScope = channel.projectId
    ? (await resolveProjectById(req, channel.projectId)) || {}
    : {};
  return {
    ...projectScope,
    channelId: channel._id,
    kind: channel.kind,
    channelMemberIds: channel.memberIds || [],
    collegeId: projectScope.collegeId ?? channel.collegeId ?? null,
    departmentId: projectScope.departmentId ?? channel.departmentId ?? null,
  };
});

registerScopeResolver('message', async (req) => {
  const id = assertObjectId(req.params?.messageId || req.params?.id, 'messageId');
  const msg = await Message.findById(id).select('channelId').lean();
  if (!msg) return null;
  const channel = await Channel.findById(msg.channelId)
    .select('projectId collegeId departmentId kind')
    .lean();
  if (!channel) return null;
  if (channel.projectId) {
    const projectScope = await resolveProjectById(req, channel.projectId);
    return projectScope ? { ...projectScope, kind: channel.kind } : null;
  }
  return {
    collegeId: channel.collegeId ?? null,
    departmentId: channel.departmentId ?? null,
    kind: channel.kind,
  };
});

const COMMENT_TARGET_MODELS = {
  submission: Submission,
  deliverable: Deliverable,
  task: Task,
};

registerScopeResolver('commentTarget', async (req) => {
  const targetType = req.query?.targetType || req.body?.targetType;
  const TargetModel = COMMENT_TARGET_MODELS[targetType];
  if (!TargetModel) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'targetType', code: 'validation.invalidEnum', message: t('validation.invalidEnum') }],
    });
  }
  const targetId = assertObjectId(req.query?.targetId || req.body?.targetId, 'targetId');
  const target = await TargetModel.findById(targetId).select('projectId').lean();
  if (!target) return null;
  return resolveProjectById(req, target.projectId);
});

registerScopeResolver('comment', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const comment = await Comment.findById(id).select('projectId').lean();
  if (!comment) return null;
  return resolveProjectById(req, comment.projectId);
});

registerScopeResolver('album', async (req) => {
  const id = assertObjectId(req.params?.albumId || req.params?.id, 'albumId');
  const album = await MediaAlbum.findById(id).select('projectId').lean();
  if (!album) return null;
  return resolveProjectById(req, album.projectId);
});

registerScopeResolver('mediaItem', async (req) => {
  const id = assertObjectId(req.params?.itemId || req.params?.id, 'itemId');
  const item = await MediaItem.findById(id).select('projectId').lean();
  if (!item) return null;
  return resolveProjectById(req, item.projectId);
});

registerScopeResolver('rubric', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const rubric = await Rubric.findById(id).select('collegeId').lean();
  if (!rubric) return null;
  return { collegeId: rubric.collegeId };
});

registerScopeResolver('defense', async (req) => {
  const id = assertObjectId(req.params?.id || req.params?.defenseId || req.body?.defenseId, 'defenseId');
  const defense = await Defense.findById(id)
    .select('projectId state chairId examinerIds')
    .lean();
  if (!defense) return null;
  const projectScope = await resolveProjectById(req, defense.projectId);
  if (!projectScope) return null;
  return {
    ...projectScope,
    defenseId: defense._id,
    defenseState: defense.state,
    chairId: defense.chairId,
    examinerIds: defense.examinerIds || [],
  };
});

registerScopeResolver('grade', async (req) => {
  const projectScope = await resolveProjectById(req, assertObjectId(req.params?.id, 'id'));
  if (!projectScope) return null;
  const studentId = assertObjectId(req.params?.studentId, 'studentId');
  return {
    ...projectScope,
    studentId,
  };
});

registerScopeResolver('reevaluation', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const reeval = await ReEvaluationRequest.findById(id)
    .select('collegeId departmentId projectId')
    .lean();
  if (!reeval) return null;
  return {
    collegeId: reeval.collegeId,
    departmentId: reeval.departmentId,
    projectId: reeval.projectId,
  };
});

registerScopeResolver('publishedProject', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const project = await Project.findById(id)
    .select('collegeId departmentId isPublished')
    .lean();
  if (!project || !project.isPublished) return null;
  return {
    publishedProjectId: project._id,
    collegeId: project.collegeId,
    departmentId: project.departmentId,
  };
});

registerScopeResolver('competition', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const competition = await Competition.findById(id)
    .select('collegeId departmentId scopeType')
    .lean();
  if (!competition) return null;
  return {
    competitionId: competition._id,
    collegeId: competition.collegeId ?? null,
    departmentId: competition.departmentId ?? null,
  };
});

registerScopeResolver('vote', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const vote = await Vote.findById(id).select('collegeId departmentId').lean();
  if (!vote) return null;
  return {
    voteId: vote._id,
    collegeId: vote.collegeId ?? null,
    departmentId: vote.departmentId ?? null,
  };
});

registerScopeResolver('contactRequest', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const reqDoc = await ContactRequest.findById(id).select('projectId').lean();
  if (!reqDoc) return null;
  return resolveProjectById(req, reqDoc.projectId);
});

registerScopeResolver('challenge', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const challenge = await Challenge.findById(id).select('investorId').lean();
  if (!challenge) return null;
  return {
    challengeId: challenge._id,
    ownerId: challenge.investorId,
  };
});

registerScopeResolver('publicComment', async (req) => {
  const id = assertObjectId(req.params?.id, 'id');
  const comment = await PublicComment.findById(id).select('projectId').lean();
  if (!comment) return null;
  const projectScope = await resolveProjectById(req, comment.projectId);
  if (!projectScope) return null;
  const { projectId: commentProjectId, ...restScope } = projectScope;
  return {
    ...restScope,
    commentProjectId,
  };
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
