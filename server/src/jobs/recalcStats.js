import { recalculateAllStatsCaches } from '../modules/reports/index.js';
import { syncCompetitionStates } from '../modules/showcase/index.js';

export async function runRecalcStatsJob() {
  const [stats, competitions] = await Promise.all([
    recalculateAllStatsCaches(),
    syncCompetitionStates(),
  ]);
  return { ...stats, competitions };
}
