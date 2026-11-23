import Project from './project.model.js';
import { hydrateProjects } from './projectShared.js';

export async function aggregateProjects(pipeline = []) {
  return Project.aggregate(pipeline);
}

export async function findAndCountReportProjects({
  match = {},
  sort = { createdAt: -1 },
  skip = 0,
  limit = 20,
} = {}) {
  const [docs, total] = await Promise.all([
    Project.find(match).sort(sort).skip(skip).limit(limit).lean(),
    Project.countDocuments(match),
  ]);
  const items = await hydrateProjects(docs);
  return { items, total };
}

export async function findSupervisedProjectsForReport(supervisorId, yearMatch = {}) {
  const docs = await Project.find({
    supervisorIds: supervisorId,
    ...yearMatch,
  })
    .sort({ updatedAt: -1 })
    .lean();
  return hydrateProjects(docs);
}
