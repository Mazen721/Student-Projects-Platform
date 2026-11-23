import ProjectPhase from './projectPhase.model.js';
import Submission from './submission.model.js';
import ToolItem from './toolItem.model.js';

export async function aggregateProjectPhases(pipeline = []) {
  return ProjectPhase.aggregate(pipeline);
}

export async function aggregateSubmissions(pipeline = []) {
  return Submission.aggregate(pipeline);
}

export async function aggregateToolItems(pipeline = []) {
  return ToolItem.aggregate(pipeline);
}
