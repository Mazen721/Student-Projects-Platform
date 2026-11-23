import mongoose from 'mongoose';
import { VOTE_STATUSES } from '@spp/shared/constants';
import { listPublishedProjectIdsForTrending, bulkUpdateProjectTrendingStats } from '../modules/projects/index.js';
import PageView from '../modules/showcase/pageView.model.js';
import Vote from '../modules/showcase/vote.model.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function runTrendingJob() {
  const cutoffDate = new Date(Date.now() - SEVEN_DAYS_MS);
  const cutoffDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(
    cutoffDate
  );

  const [projects, voteCounts, viewCounts] = await Promise.all([
    listPublishedProjectIdsForTrending(),
    Vote.aggregate([
      {
        $match: {
          status: mongoose.trusted({ $in: [VOTE_STATUSES.VALID, VOTE_STATUSES.CLEARED] }),
          createdAt: mongoose.trusted({ $gte: cutoffDate }),
        },
      },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
    PageView.aggregate([
      {
        $match: {
          day: mongoose.trusted({ $gte: cutoffDay }),
        },
      },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
  ]);

  const votesMap = new Map(voteCounts.map((entry) => [String(entry._id), entry.count]));
  const viewsMap = new Map(viewCounts.map((entry) => [String(entry._id), entry.count]));

  const updates = projects.map((proj) => ({
    projectId: proj._id,
    votes7d: votesMap.get(String(proj._id)) || 0,
    views7d: viewsMap.get(String(proj._id)) || 0,
  }));

  const modifiedCount = await bulkUpdateProjectTrendingStats(updates);
  return { processed: projects.length, modifiedCount };
}
