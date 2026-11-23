import mongoose from 'mongoose';
import { SIMILAR_TITLE_LIMIT, SIMILAR_TITLE_THRESHOLD } from '@spp/shared/constants';
import { normalizeArabic, trigramSimilarity } from '@spp/shared/text';
import { env } from '../../config/env.js';

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAtlasFilterClauses(filter = {}) {
  const clauses = [];
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'boolean' || typeof value === 'string') {
      clauses.push({ equals: { path: key, value } });
    } else if (value?._bsontype === 'ObjectId') {
      clauses.push({ equals: { path: key, value } });
    }
  }
  return clauses;
}

export async function searchProjects(
  ProjectModel,
  { q = '', scopeFilter = {}, filters = {}, skip = 0, limit = 20, sort = { createdAt: -1, _id: -1 } }
) {
  const normalizedQuery = normalizeArabic(q);
  const baseFilter = { ...scopeFilter, ...filters };

  if (!normalizedQuery) {
    const [items, total] = await Promise.all([
      ProjectModel.find(baseFilter).sort(sort).skip(skip).limit(limit).lean(),
      ProjectModel.countDocuments(baseFilter),
    ]);
    return { items, total };
  }

  if (env.SEARCH_PROVIDER === 'atlas') {
    const atlasFilters = buildAtlasFilterClauses(filters);
    const pipeline = [
      {
        $search: {
          index: 'projects_search',
          compound: {
            must: [
              {
                text: {
                  query: q,
                  path: ['title', 'titleNormalized', 'idea', 'keywords'],
                },
              },
            ],
            ...(atlasFilters.length > 0 ? { filter: atlasFilters } : {}),
          },
        },
      },
      ...(Object.keys(scopeFilter).length > 0 ? [{ $match: scopeFilter }] : []),
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          meta: [{ $count: 'total' }],
        },
      },
    ];
    const [res] = await ProjectModel.aggregate(pipeline);
    return {
      items: res?.items || [],
      total: res?.meta?.[0]?.total || 0,
    };
  }

  const regex = new RegExp(escapeRegex(normalizedQuery), 'i');
  const queryFilter = {
    $and: [
      baseFilter,
      {
        $or: [{ titleNormalized: regex }, { keywords: regex }],
      },
    ],
  };

  const [items, total] = await Promise.all([
    ProjectModel.find(queryFilter).sort(sort).skip(skip).limit(limit).lean(),
    ProjectModel.countDocuments(queryFilter),
  ]);
  return { items, total };
}

export async function findSimilarProjectTitles(
  ProjectModel,
  { title, excludeId = null, limit = SIMILAR_TITLE_LIMIT }
) {
  const normalizedTitle = normalizeArabic(title);
  if (!normalizedTitle) return [];

  const excludeClause = excludeId ? { _id: mongoose.trusted({ $ne: excludeId }) } : {};

  if (env.SEARCH_PROVIDER === 'atlas') {
    const pipeline = [
      {
        $search: {
          index: 'projects_search',
          compound: {
            should: [
              { text: { query: title, path: 'title', fuzzy: { maxEdits: 1 } } },
              { moreLikeThis: { like: { title } } },
            ],
            minimumShouldMatch: 1,
          },
        },
      },
      ...(excludeId ? [{ $match: excludeClause }] : []),
      { $addFields: { score: { $meta: 'searchScore' } } },
      { $match: { score: { $gte: 3.0 } } },
      { $limit: limit },
      { $project: { _id: 1, title: 1, score: 1 } },
    ];
    return ProjectModel.aggregate(pipeline);
  }

  let candidates = [];
  try {
    candidates = await ProjectModel.find({
      ...excludeClause,
      $text: mongoose.trusted({ $search: normalizedTitle }),
    })
      .select('_id title')
      .limit(50)
      .lean();
  } catch (err) {
    if (err?.code !== 27) throw err;
  }

  if (candidates.length === 0) {
    candidates = await ProjectModel.find(excludeClause).select('_id title').limit(50).lean();
  }

  return candidates
    .map((candidate) => ({
      id: String(candidate._id),
      title: candidate.title,
      score: Number(trigramSimilarity(title, candidate.title).toFixed(3)),
    }))
    .filter((entry) => entry.score >= SIMILAR_TITLE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function searchChannelMessages(
  MessageModel,
  { channelId, q = '', skip = 0, limit = 20 }
) {
  const normalizedQuery = normalizeArabic(q);
  if (!normalizedQuery) return { items: [], total: 0 };

  if (env.SEARCH_PROVIDER === 'atlas') {
    const pipeline = [
      {
        $search: {
          index: 'messages_search',
          compound: {
            must: [{ text: { query: q, path: 'textNormalized' } }],
            filter: [{ equals: { path: 'channelId', value: channelId } }],
          },
        },
      },
      { $match: { removed: null } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          meta: [{ $count: 'total' }],
        },
      },
    ];
    const [res] = await MessageModel.aggregate(pipeline);
    return {
      items: res?.items || [],
      total: res?.meta?.[0]?.total || 0,
    };
  }

  const filter = {
    channelId,
    removed: null,
    textNormalized: mongoose.trusted({ $regex: escapeRegex(normalizedQuery), $options: 'i' }),
  };
  const [items, total] = await Promise.all([
    MessageModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    MessageModel.countDocuments(filter),
  ]);
  return { items, total };
}
