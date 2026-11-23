import mongoose from 'mongoose';
import { MODIFICATION_STATES } from '@spp/shared/constants';
import { sendBulkNotifications } from '../core/notifications/notify.service.js';
import Defense from '../modules/evaluation/defense.model.js';
import { getProjectForEvaluation } from '../modules/projects/index.js';

export async function runModificationsOverdueJob() {
  const now = new Date();
  const overdueDefenses = await Defense.find({
    'modifications.required': true,
    'modifications.state': MODIFICATION_STATES.PENDING,
    'modifications.deadline': mongoose.trusted({ $lt: now }),
  }).lean();

  if (overdueDefenses.length === 0) return 0;

  let updatedCount = 0;
  for (const defense of overdueDefenses) {
    const res = await Defense.updateOne(
      { _id: defense._id, 'modifications.state': MODIFICATION_STATES.PENDING },
      { $set: { 'modifications.state': MODIFICATION_STATES.OVERDUE } }
    );
    if (res.modifiedCount === 0) continue;
    updatedCount += 1;

    const project = await getProjectForEvaluation(defense.projectId).catch(() => null);
    if (!project) continue;

    const recipients = Array.from(
      new Set([
        ...(project.supervision?.primaryId ? [String(project.supervision.primaryId)] : []),
        ...(project.activeMemberIds || []).map(String),
      ])
    );
    await sendBulkNotifications(
      recipients.map((userId) => ({
        userId,
        type: 'modifications_overdue',
        titleKey: 'notifications.modificationsOverdueTitle',
        bodyKey: 'notifications.modificationsOverdueBody',
        vars: { project: project.title },
        link: `/app/projects/${project._id}`,
        dedupeKey: `mod_overdue:${defense._id}`,
      }))
    );
  }

  return updatedCount;
}
