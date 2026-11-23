import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  PROPOSAL_STATUSES,
  ROLES,
  SHOWCASE_STATES,
  SHOWCASE_THEMES,
  UPLOAD_PURPOSES,
} from '@spp/shared/constants';
import { voteEligibility } from '@spp/shared/calc';
import { t } from '@spp/shared/locales/ar';
import { showcaseMachine } from '@spp/shared/machines';
import { recordAudit } from '../../core/audit/audit.service.js';
import { verifyAccessToken } from '../../core/auth/tokens.js';
import { AppError } from '../../core/errors/AppError.js';
import { sendBulkNotifications } from '../../core/notifications/notify.service.js';
import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { verifyUpload } from '../../core/uploads/verifyUpload.js';
import {
  findShowcaseTeamUsersByIds,
  findUserBasicById,
} from '../auth/index.js';
import { listPublicProjectMedia } from '../collaboration/index.js';
import {
  getCollegesAndDepartmentsMap,
  getUniversityShowcaseConfig,
  listPublicColleges,
  setUniversityFeaturedProjectIds,
} from '../organization/index.js';
import {
  getProjectForShowcase,
  getPublishedProjectBySlug,
  incrementProjectShowcaseStats,
  listPublishedProjectsByIds,
  listPublishedProjectsForShowcase,
  updateProjectShowcasePublishState,
} from '../projects/index.js';
import PageView from './pageView.model.js';
import ShowcasePage from './showcasePage.model.js';
import Vote from './vote.model.js';

const ALLOWLIST_SECTIONS = [
  'hero',
  'problem',
  'solution',
  'features',
  'technologies',
  'components',
  'video',
  'achievements',
  'interest',
];

const STAFF_ADMIN_ROLES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

const SORT_MAP = {
  trending: { 'showcaseStats.trendingScore': -1, createdAt: -1 },
  votes: { 'showcaseStats.validVotes': -1, createdAt: -1 },
  recent: { createdAt: -1 },
};

function getActorMachineRoles(actor, project) {
  const roles = [];
  const actorId = String(actor.id);
  if ((project.activeMemberIds || []).some((id) => String(id) === actorId)) {
    roles.push('teamMember');
  }
  const sup = project.supervision || {};
  const isSup =
    String(sup.primaryId) === actorId ||
    String(sup.reviewerId) === actorId ||
    (sup.coSupervisorIds || []).some((id) => String(id) === actorId) ||
    (sup.mentorIds || []).some((id) => String(id) === actorId);
  if (isSup) {
    roles.push(ROLES.SUPERVISOR);
  }
  for (const assignment of actor.roles || []) {
    if (STAFF_ADMIN_ROLES.has(assignment.role)) {
      roles.push(assignment.role);
    }
  }
  return [...new Set(roles)];
}

function getActorTopRoleName(actor, machineRoles) {
  for (const assignment of actor.roles || []) {
    if (STAFF_ADMIN_ROLES.has(assignment.role)) return assignment.role;
  }
  return machineRoles[0] || actor.roles?.[0]?.role || '';
}

async function ensureShowcasePage(project) {
  let page = await ShowcasePage.findOne({ projectId: project._id });
  if (page) return page;
  page = await ShowcasePage.create({
    projectId: project._id,
    slug: project.slug,
    state: SHOWCASE_STATES.DRAFT,
    everApproved: false,
    template: 'classic',
    theme: SHOWCASE_THEMES.NAVY_GOLD,
    sections: {},
    hiddenSections: [],
    collegeId: project.collegeId,
    departmentId: project.departmentId,
  });
  return page;
}

function serializeTeamShowcase(page, project) {
  return {
    id: String(page._id),
    projectId: String(page.projectId),
    slug: page.slug,
    state: page.state,
    everApproved: Boolean(page.everApproved),
    template: page.template,
    theme: page.theme,
    sections: page.sections || {},
    hiddenSections: page.hiddenSections || [],
    takedown: page.takedown || null,
    history: page.history || [],
    project: {
      id: String(project._id),
      title: project.title,
      status: project.status,
      isPublished: Boolean(project.isPublished),
    },
  };
}

function filterAllowedSections(rawSections = {}, hiddenSections = []) {
  const hidden = new Set(hiddenSections || []);
  const filtered = {};
  for (const key of ALLOWLIST_SECTIONS) {
    if (hidden.has(key) || rawSections[key] === undefined) continue;
    if (key === 'components') {
      filtered.components = Array.isArray(rawSections.components)
        ? rawSections.components.map((entry) => String(entry))
        : [];
    } else if (key === 'hero') {
      const hero = rawSections.hero || {};
      filtered.hero = {
        ...(hero.slogan ? { slogan: hero.slogan } : {}),
        ...(hero.cover?.url ? { cover: { url: hero.cover.url } } : {}),
      };
    } else {
      filtered[key] = rawSections[key];
    }
  }
  return filtered;
}

function buildPublicTeamList(memberIds = [], usersMap) {
  const result = [];
  for (const memberId of memberIds) {
    const member = usersMap.get(String(memberId));
    if (!member) continue;
    const sharedContacts = {};
    if (member.privacy?.email === 'public' && member.email) {
      sharedContacts.email = member.email;
    }
    if (member.privacy?.phone === 'public' && member.phone) {
      sharedContacts.phone = member.phone;
    }
    if (member.privacy?.socialLinks === 'public' && member.socialLinks) {
      sharedContacts.socialLinks = member.socialLinks;
    }
    result.push({
      name: member.name,
      avatar: member.avatar || null,
      sharedContacts,
    });
  }
  return result;
}

function sanitizePublicGallery(items = []) {
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    url: item.signedUrl || item.file?.url || null,
    link: item.link || null,
    caption: item.caption || '',
  }));
}

async function resolvePublicProjectPayload(project, page, viewerInfo = null) {
  const [{ collegeMap, departmentMap }, usersMap, supervisor, galleryItems] = await Promise.all([
    getCollegesAndDepartmentsMap([project.collegeId], [project.departmentId]),
    findShowcaseTeamUsersByIds(project.activeMemberIds || []),
    project.supervision?.primaryId ? findUserBasicById(project.supervision.primaryId) : null,
    listPublicProjectMedia(project._id),
  ]);

  const sections = filterAllowedSections(page.sections || {}, page.hiddenSections || []);
  const college = collegeMap.get(String(project.collegeId));
  const department = departmentMap.get(String(project.departmentId));

  return {
    id: String(project._id),
    slug: project.slug,
    title: project.title,
    idea: project.idea,
    field: project.field,
    type: project.type,
    cover: project.cover?.url ? { url: project.cover.url } : null,
    college: college ? { id: String(college._id), name: college.name } : null,
    department: department ? { id: String(department._id), name: department.name } : null,
    academicYearLabel: project.academicYearLabel,
    template: page.template,
    theme: page.theme,
    sections,
    gallery: sanitizePublicGallery(galleryItems),
    video: sections.video || null,
    team: buildPublicTeamList(project.activeMemberIds || [], usersMap),
    supervisor: supervisor ? { name: supervisor.name } : null,
    achievements: sections.achievements || [],
    voteCount: project.showcaseStats?.validVotes || 0,
    ...(viewerInfo ? { viewer: viewerInfo } : {}),
  };
}

export async function hydratePublicCards(projects = [], featuredIds = new Set()) {
  if (projects.length === 0) return [];
  const { collegeMap, departmentMap } = await getCollegesAndDepartmentsMap(
    projects.map((p) => p.collegeId),
    projects.map((p) => p.departmentId)
  );
  return projects.map((project) => {
    const college = collegeMap.get(String(project.collegeId));
    const department = departmentMap.get(String(project.departmentId));
    return {
      id: String(project._id),
      slug: project.slug,
      title: project.title,
      idea: project.idea,
      field: project.field,
      type: project.type,
      cover: project.cover?.url ? { url: project.cover.url } : null,
      college: college ? { id: String(college._id), name: college.name } : null,
      department: department ? { id: String(department._id), name: department.name } : null,
      academicYearLabel: project.academicYearLabel,
      voteCount: project.showcaseStats?.validVotes || 0,
      views7d: project.showcaseStats?.views7d || 0,
      trendingScore: project.showcaseStats?.trendingScore || 0,
      isFeatured: featuredIds.has(String(project._id)),
    };
  });
}

export async function getTeamShowcasePage(projectId) {
  const project = await getProjectForShowcase(projectId);
  const page = await ensureShowcasePage(project);
  return serializeTeamShowcase(page, project);
}

export async function updateTeamShowcasePage(projectId, payload, { actor }) {
  const project = await getProjectForShowcase(projectId);
  const isTeam = (project.activeMemberIds || []).some((id) => String(id) === String(actor.id));
  if (!isTeam) {
    throw AppError.forbidden();
  }

  const page = await ensureShowcasePage(project);
  const nextSections = { ...(payload.sections || {}) };
  if (nextSections.hero?.cover && nextSections.hero.cover.signature) {
    nextSections.hero = {
      ...nextSections.hero,
      cover: await verifyUpload(nextSections.hero.cover, {
        userId: actor.id,
        expectedPurpose: UPLOAD_PURPOSES.SHOWCASE,
        expectedProjectId: String(project._id),
      }),
    };
  }

  page.template = payload.template;
  page.theme = payload.theme;
  page.sections = nextSections;
  page.hiddenSections = payload.hiddenSections || [];
  await page.save();

  return serializeTeamShowcase(page, project);
}

export async function previewTeamShowcasePage(projectId) {
  const project = await getProjectForShowcase(projectId);
  const page = await ensureShowcasePage(project);
  return resolvePublicProjectPayload(project, page);
}

function mapMachineRejection(code) {
  if (code === 'FORBIDDEN') return AppError.forbidden();
  if (code === 'VALIDATION_ERROR') {
    return new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'reason', code: 'validation.required', message: t('validation.required') }],
    });
  }
  if (code === 'PROJECT_NOT_APPROVED' || code === 'PUBLISH_REQUIRES_APPROVAL') {
    return AppError.businessRule(code);
  }
  return new AppError('INVALID_TRANSITION');
}

async function notifyShowcaseTransition(project, event, page, actorId) {
  if (event === 'REQUEST_PUBLISH' && project.supervision?.primaryId) {
    await sendBulkNotifications([
      {
        userId: project.supervision.primaryId,
        type: 'showcase_publish_requested',
        titleKey: 'notifications.showcasePublishRequestedTitle',
        bodyKey: 'notifications.showcasePublishRequestedBody',
        vars: { project: project.title },
        link: `/app/projects/${project._id}`,
      },
    ]);
    return;
  }
  const recipients = (project.activeMemberIds || []).filter((id) => String(id) !== String(actorId));
  if (recipients.length === 0) return;

  if (event === 'APPROVE') {
    await sendBulkNotifications(
      recipients.map((userId) => ({
        userId,
        type: 'showcase_approved',
        titleKey: 'notifications.showcaseApprovedTitle',
        bodyKey: 'notifications.showcaseApprovedBody',
        vars: { project: project.title },
        link: `/p/${page.slug}`,
      }))
    );
  } else if (event === 'REJECT_PUBLISH' || event === 'TAKE_DOWN') {
    const isTakeDown = event === 'TAKE_DOWN';
    await sendBulkNotifications(
      recipients.map((userId) => ({
        userId,
        type: isTakeDown ? 'showcase_taken_down' : 'showcase_rejected',
        titleKey: isTakeDown
          ? 'notifications.showcaseTakenDownTitle'
          : 'notifications.showcaseRejectedTitle',
        bodyKey: isTakeDown
          ? 'notifications.showcaseTakenDownBody'
          : 'notifications.showcaseRejectedBody',
        vars: { project: project.title, reason: page.takedown?.reason || '' },
        link: `/app/projects/${project._id}`,
      }))
    );
  }
}

export async function transitionShowcasePage(projectId, { event, reason }, { actor, ip }) {
  const project = await getProjectForShowcase(projectId);
  const page = await ensureShowcasePage(project);
  const machineRoles = getActorMachineRoles(actor, project);
  const transitionDef = showcaseMachine.transitions[event];
  if (
    transitionDef?.roles?.length > 0 &&
    !transitionDef.roles.some((role) => machineRoles.includes(role))
  ) {
    throw AppError.forbidden();
  }
  const projectApproved =
    project.status === PROPOSAL_STATUSES.APPROVED || project.status === PROPOSAL_STATUSES.ARCHIVED;

  const evalResult = showcaseMachine.evaluate(page.state, event, {
    roles: machineRoles,
    projectApproved,
    everApproved: Boolean(page.everApproved),
    reason,
  });
  if (!evalResult.allowed) {
    throw mapMachineRejection(evalResult.code);
  }

  const prevState = page.state;
  const nextState = evalResult.to;
  const actorRole = getActorTopRoleName(actor, machineRoles);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      page.state = nextState;
      if (nextState === SHOWCASE_STATES.PUBLISHED) {
        page.everApproved = true;
      }
      if (nextState === SHOWCASE_STATES.TAKEN_DOWN) {
        page.takedown = { by: actor.id, reason: reason?.trim(), at: new Date() };
      }
      page.history.push({
        from: prevState,
        to: nextState,
        event,
        actorId: actor.id,
        actorRole,
        reason: reason?.trim() || undefined,
        at: new Date(),
      });
      await page.save({ session });
      await updateProjectShowcasePublishState(
        project._id,
        nextState === SHOWCASE_STATES.PUBLISHED,
        { session }
      );

      if (event === 'TAKE_DOWN' || event === 'REJECT_PUBLISH') {
        await recordAudit({
          actorId: actor.id,
          actorRole,
          action: event === 'TAKE_DOWN' ? 'showcase.takeDown' : 'showcase.rejectPublish',
          targetType: 'showcasePage',
          targetId: page._id,
          scope: {
            collegeId: project.collegeId,
            departmentId: project.departmentId,
            projectId: project._id,
          },
          before: { state: prevState },
          after: { state: nextState },
          reason: reason?.trim(),
          ip,
          session,
        });
      }
    });
  } finally {
    await session.endSession();
  }

  await notifyShowcaseTransition(project, event, page, actor.id);
  const refreshedProject = { ...project, isPublished: nextState === SHOWCASE_STATES.PUBLISHED };
  return serializeTeamShowcase(page, refreshedProject);
}

async function resolveOptionalViewer(authHeader, project) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return null;
  try {
    const payload = verifyAccessToken(rawToken);
    const [user, existingVote, uniConfig] = await Promise.all([
      findUserBasicById(payload.sub),
      Vote.exists({ projectId: project._id, userId: payload.sub }),
      getUniversityShowcaseConfig(),
    ]);
    if (!user) return null;
    const hasVoted = Boolean(existingVote);
    const eligibility = voteEligibility({
      user,
      project,
      minAccountAgeHours: uniConfig.minVoteAccountAgeHours,
    });
    return { hasVoted, canVote: !hasVoted && eligibility.eligible };
  } catch {
    return null;
  }
}

export async function getPublicProjectDetail(slug, { authHeader } = {}) {
  const project = await getPublishedProjectBySlug(slug);
  if (!project) throw AppError.notFound();
  const page = await ShowcasePage.findOne({
    projectId: project._id,
    state: SHOWCASE_STATES.PUBLISHED,
  }).lean();
  if (!page) throw AppError.notFound();

  const viewer = await resolveOptionalViewer(authHeader, project);
  return resolvePublicProjectPayload(project, page, viewer);
}

export async function recordPublicPageView(slug, { ip, userAgent }) {
  const project = await getPublishedProjectBySlug(slug);
  if (!project) throw AppError.notFound();

  const visitorKey = crypto
    .createHash('sha256')
    .update(`${ip || 'unknown'}|${userAgent || ''}`)
    .digest('hex');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

  try {
    await PageView.create({ projectId: project._id, visitorKey, day });
    await incrementProjectShowcaseStats(project._id, { views7d: 1 });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
}

export async function getPublicHome() {
  const uniConfig = await getUniversityShowcaseConfig();
  const featuredSet = new Set(uniConfig.featuredProjectIds || []);

  const [featuredRaw, trendingRes, mostVotedRes, colleges] = await Promise.all([
    listPublishedProjectsByIds(uniConfig.featuredProjectIds || []),
    listPublishedProjectsForShowcase({
      limit: 6,
      sort: SORT_MAP.trending,
    }),
    listPublishedProjectsForShowcase({
      limit: 6,
      sort: SORT_MAP.votes,
    }),
    listPublicColleges(),
  ]);

  const [featured, trending, mostVoted] = await Promise.all([
    hydratePublicCards(featuredRaw, featuredSet),
    hydratePublicCards(trendingRes.items, featuredSet),
    hydratePublicCards(mostVotedRes.items, featuredSet),
  ]);

  return { featured, trending, mostVoted, colleges };
}

export async function listPublicProjects(query = {}) {
  const { page, limit, skip } = parsePagination(query, ['trending', 'votes', 'recent']);
  const filters = {};
  if (query.collegeId) filters.collegeId = query.collegeId;
  if (query.departmentId) filters.departmentId = query.departmentId;
  if (query.field) filters.field = query.field;
  if (query.type) filters.type = query.type;
  if (query.academicYearId) filters.academicYearId = query.academicYearId;

  const sort = SORT_MAP[query.sort] || SORT_MAP.trending;
  const [{ items, total }, uniConfig] = await Promise.all([
    listPublishedProjectsForShowcase({ q: query.q || '', filters, skip, limit, sort }),
    getUniversityShowcaseConfig(),
  ]);

  const cards = await hydratePublicCards(items, new Set(uniConfig.featuredProjectIds || []));
  return {
    items: cards,
    page: buildPageMeta({ page, limit, total }),
  };
}

export async function getPublicCollegeShowcase(collegeId, query = {}) {
  const { collegeMap } = await getCollegesAndDepartmentsMap([collegeId], []);
  const college = collegeMap.get(String(collegeId));
  if (!college) throw AppError.notFound();

  const list = await listPublicProjects({ ...query, collegeId });
  return {
    college: { id: String(college._id), name: college.name, code: college.code },
    items: list.items,
    page: list.page,
  };
}

export async function setUniversityFeatured(projectIds, { actor, ip }) {
  const published = await listPublishedProjectsByIds(projectIds);
  const validSet = new Set(published.map((p) => String(p._id)));
  const orderedValidIds = projectIds.map(String).filter((id) => validSet.has(id));
  const saved = await setUniversityFeaturedProjectIds(orderedValidIds, { actor, ip });
  return { featuredProjectIds: saved };
}
