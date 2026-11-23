import { recalculateAllStatsCaches } from '../modules/reports/index.js';

export async function runRecalcStatsJob() {
  return recalculateAllStatsCaches();
}
