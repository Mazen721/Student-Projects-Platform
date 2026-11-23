import cron from 'node-cron';
import mongoose from 'mongoose';
import pino from 'pino';
import { env } from '../config/env.js';
import { runCleanupJob } from './cleanup.js';
import { runDeadlineReminders } from './deadlineReminders.js';
import { runModificationsOverdueJob } from './modificationsOverdue.js';
import { runRecalcStatsJob } from './recalcStats.js';
import { runTrendingJob } from './trending.js';
import JobLock from './jobLock.model.js';

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' });
const DEFAULT_LEASE_MS = 10 * 60 * 1000;
const CAIRO_TIMEZONE = 'Africa/Cairo';
const tasks = [];

export const JOB_DEFINITIONS = Object.freeze([
  { name: 'recalcStats', expression: '*/15 * * * *', runner: runRecalcStatsJob },
  { name: 'trending', expression: '0 * * * *', runner: runTrendingJob },
  { name: 'deadlineReminders', expression: '0 7 * * *', runner: runDeadlineReminders },
  { name: 'modificationsOverdue', expression: '30 7 * * *', runner: runModificationsOverdueJob },
  { name: 'cleanup', expression: '0 3 * * *', runner: runCleanupJob },
]);

export async function runWithLock(lockName, fn, ttlMs = DEFAULT_LEASE_MS) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + ttlMs);
  const acquired = await JobLock.findOneAndUpdate(
    {
      _id: lockName,
      $or: [
        { lockedUntil: mongoose.trusted({ $lte: now }) },
        { lockedUntil: mongoose.trusted({ $exists: false }) },
      ],
    },
    { $set: { lockedUntil: lockUntil, lockedBy: String(process.pid), updatedAt: now } },
    { upsert: true, new: true }
  ).catch((err) => {
    if (err?.code === 11000) return null;
    throw err;
  });
  if (!acquired) return false;
  try {
    await fn();
    return true;
  } catch (err) {
    logger.error({ err, job: lockName }, 'Scheduled job failed');
    return false;
  }
}

export function startScheduler() {
  if (env.NODE_ENV === 'test' || tasks.length > 0) return tasks;

  for (const job of JOB_DEFINITIONS) {
    const scheduled = cron.schedule(
      job.expression,
      () => runWithLock(job.name, () => job.runner()),
      { timezone: CAIRO_TIMEZONE }
    );
    tasks.push(scheduled);
  }
  return tasks;
}

export function stopScheduler() {
  while (tasks.length > 0) {
    const task = tasks.pop();
    task.stop();
  }
}
