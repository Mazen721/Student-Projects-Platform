import { buildPageMeta, parsePagination } from '../../core/pagination.js';
import { findUsersBasicByIds } from '../auth/index.js';
import { getProjectForTracking } from '../projects/index.js';
import TimelineEvent from './timelineEvent.model.js';

export async function logTimelineEvent({
  projectId,
  type,
  actorId,
  refType,
  refId,
  summaryKey,
  data = {},
  session = null,
}) {
  const doc = {
    projectId,
    type,
    actorId,
    refType,
    refId,
    summaryKey,
    data,
    at: new Date(),
  };
  const [created] = await TimelineEvent.create([doc], session ? { session } : undefined);
  return created;
}

export async function listProjectTimeline(projectId, query = {}) {
  await getProjectForTracking(projectId);
  const { page, limit, skip } = parsePagination(query, ['-at', 'at']);
  const filter = { projectId };
  if (query.type) {
    filter.type = query.type;
  }

  const [events, total] = await Promise.all([
    TimelineEvent.find(filter).sort({ at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    TimelineEvent.countDocuments(filter),
  ]);

  const userMap = await findUsersBasicByIds(events.map((e) => e.actorId));
  const items = events.map((e) => ({
    id: String(e._id),
    projectId: String(e.projectId),
    type: e.type,
    actorId: String(e.actorId),
    actorName: userMap.get(String(e.actorId))?.name || '',
    refType: e.refType || null,
    refId: e.refId ? String(e.refId) : null,
    summaryKey: e.summaryKey,
    data: e.data || {},
    at: e.at,
  }));

  return {
    items,
    page: buildPageMeta({ page, limit, total }),
  };
}
