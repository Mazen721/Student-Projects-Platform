import Grade from './grade.model.js';

export async function aggregateGrades(pipeline = []) {
  return Grade.aggregate(pipeline);
}
