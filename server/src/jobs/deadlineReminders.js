import mongoose from 'mongoose';
import { DELIVERABLE_STATUSES } from '@spp/shared/constants';
import { sendBulkNotifications } from '../core/notifications/notify.service.js';
import { listApprovedProjectsForReminders } from '../modules/projects/index.js';
import Deliverable from '../modules/tracking/deliverable.model.js';

const REMINDER_OFFSETS_DAYS = [0, 1, 3];

function utcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function dayDiffUtc(targetDate, nowDate) {
  const targetDay = Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate()
  );
  const nowDay = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );
  return Math.round((targetDay - nowDay) / 86400000);
}

export async function runDeadlineReminders(now = new Date()) {
  const projects = await listApprovedProjectsForReminders();
  if (projects.length === 0) return 0;

  const projectMap = new Map(projects.map((p) => [String(p._id), p]));
  const maxWindowEnd = new Date(now.getTime() + 4 * 86400000);
  const minWindowStart = new Date(now.getTime() - 1 * 86400000);

  const deliverables = await Deliverable.find({
    projectId: mongoose.trusted({ $in: projects.map((p) => p._id) }),
    latestStatus: mongoose.trusted({ $ne: DELIVERABLE_STATUSES.APPROVED }),
    dueDate: mongoose.trusted({ $gte: minWindowStart, $lte: maxWindowEnd }),
  })
    .select('_id projectId title dueDate')
    .lean();

  const dayStamp = utcDayKey(now);
  const notifications = [];

  for (const deliv of deliverables) {
    const diff = dayDiffUtc(new Date(deliv.dueDate), now);
    if (!REMINDER_OFFSETS_DAYS.includes(diff)) continue;
    const project = projectMap.get(String(deliv.projectId));
    if (!project) continue;

    for (const memberId of project.activeMemberIds || []) {
      notifications.push({
        userId: memberId,
        type: 'deadline_reminder',
        titleKey: 'notifications.deadlineReminder',
        bodyKey: 'notifications.deadlineReminder',
        vars: { title: deliv.title, daysLeft: diff },
        link: `/app/projects/${String(project._id)}`,
        dedupeKey: `deadline:${String(deliv._id)}:${String(memberId)}:${diff}d:${dayStamp}`,
      });
    }
  }

  if (notifications.length === 0) return 0;
  const created = await sendBulkNotifications(notifications);
  return created.length;
}
