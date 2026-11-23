import cron from 'node-cron';
import pino from 'pino';
import { env } from '../config/env.js';
import { runDeadlineReminders } from './deadlineReminders.js';
import { runModificationsOverdueJob } from './modificationsOverdue.js';
import { runTrendingJob } from './trending.js';
import JobLock from './jobLock.model.js';

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' });
const tasks = [];

async function runWithLock(lockName, fn, ttlMs = 300000) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + ttlMs);
  const acquired = await JobLock.findOneAndUpdate(
    { _id: lockName, $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }] },
    { $set: { lockedUntil: lockUntil, lockedBy: String(process.pid), updatedAt: now } },
    { upsert: true, new: true }
  ).catch((err) => {
    if (err?.code === 11000) return null;
    throw err;
  });
  if (!acquired) return;
  try {
    await fn();
  } catch (err) {
    logger.error({ err, job: lockName }, 'Scheduled job failed');
  }
}

export function startScheduler() {
  if (env.NODE_ENV === 'test' || tasks.length > 0) return;

  const deadlineTask = cron.schedule(
    '0 8 * * *',
    () => runWithLock('deadlineReminders', () => runDeadlineReminders()),
    { timezone: 'Africa/Cairo' }
  );
  const modificationsTask = cron.schedule(
    '15 8 * * *',
    () => runWithLock('modificationsOverdue', () => runModificationsOverdueJob()),
    { timezone: 'Africa/Cairo' }
  );
  const trendingTask = cron.schedule(
    '0 * * * *',
    () => runWithLock('trending', () => runTrendingJob()),
    { timezone: 'Africa/Cairo' }
  );
  tasks.push(deadlineTask, modificationsTask, trendingTask);
}

export function stopScheduler() {
  while (tasks.length > 0) {
    const task = tasks.pop();
    task.stop();
  }
}
