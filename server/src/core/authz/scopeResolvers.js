import { OBJECT_ID_RE } from '@spp/shared/schemas';
import { t } from '@spp/shared/locales/ar';
import User from '../../modules/auth/user.model.js';
import Invitation from '../../modules/auth/invitation.model.js';
import College from '../../modules/organization/college.model.js';
import Department from '../../modules/organization/department.model.js';
import AcademicYear from '../../modules/organization/academicYear.model.js';
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
