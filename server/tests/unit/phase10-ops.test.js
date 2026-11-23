import { describe, expect, it, vi } from 'vitest';
import { JOB_DEFINITIONS, runWithLock } from '../../src/jobs/scheduler.js';
import JobLock from '../../src/jobs/jobLock.model.js';
import { getAtlasStorageUsage } from '../../src/modules/reports/reports.service.js';
import {
  loadAtlasIndexDefinitions,
  syncSearchIndexes,
} from '../../src/scripts/sync-search-indexes.js';

describe('Phase 10 Operations: Scheduler, Atlas Search Sync & M0 Storage Readout', () => {
  it('registers all 5 required cron jobs in scheduler definitions', () => {
    const names = JOB_DEFINITIONS.map((j) => j.name).sort();
    expect(names).toEqual([
      'cleanup',
      'deadlineReminders',
      'modificationsOverdue',
      'recalcStats',
      'trending',
    ]);
  });

  it('acquires JobLock atomically and prevents concurrent duplicate runs within lease window', async () => {
    const runner = vi.fn().mockResolvedValue(undefined);
    const first = await runWithLock('testJob', runner, 60_000);
    const second = await runWithLock('testJob', runner, 60_000);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(runner).toHaveBeenCalledTimes(1);

    const lockDoc = await JobLock.findById('testJob').lean();
    expect(lockDoc).toBeTruthy();
  });

  it('loads valid Atlas Search definitions and creates/updates indexes cleanly', async () => {
    const definitions = await loadAtlasIndexDefinitions();
    expect(definitions.map((d) => d.name)).toEqual(['projects_search', 'messages_search']);

    const created = [];
    const updated = [];
    const mockDb = {
      listCollections: () => ({ toArray: async () => [{ name: 'projects' }] }),
      createCollection: async () => {},
      collection: (colName) => ({
        listSearchIndexes: (idxName) => ({
          toArray: async () =>
            colName === 'projects' ? [{ name: idxName, status: 'READY' }] : [],
        }),
        updateSearchIndex: async (name, definition) => {
          updated.push({ colName, name, definition });
        },
        createSearchIndex: async (payload) => {
          created.push({ colName, payload });
        },
      }),
    };

    const results = await syncSearchIndexes(mockDb, definitions);
    expect(results).toHaveLength(2);
    expect(updated).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(results[0].action).toBe('updated');
    expect(results[1].action).toBe('created');
  });

  it('computes Atlas M0 storage usage against 512 MB limit', async () => {
    const usage = await getAtlasStorageUsage();
    expect(usage).toBeTruthy();
    expect(usage.limitMb).toBe(512);
    expect(usage.warningMb).toBe(350);
    expect(usage.criticalMb).toBe(440);
    expect(['normal', 'warning', 'critical']).toContain(usage.level);
    expect(usage.usedMb).toBeGreaterThanOrEqual(0);
  });
});
