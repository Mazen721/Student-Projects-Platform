import mongoose from 'mongoose';
import { DELIVERABLE_STATUSES } from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { sendBulkNotifications, sendNotification } from '../../core/notifications/notify.service.js';
import { getSignedDeliveryUrl } from '../../core/uploads/cloudinarySign.js';
import { verifyUpload } from '../../core/uploads/verifyUpload.js';
import { findUsersBasicByIds } from '../auth/index.js';
import { getProjectForTracking } from '../projects/index.js';
import Deliverable from './deliverable.model.js';
import {
  assertDefenseNotScheduled,
  getActorRoleName,
  recalculateProjectProgress,
} from './phases.service.js';
import Submission from './submission.model.js';
import { logTimelineEvent } from './timeline.service.js';

function formatSubmission(doc, userMap = new Map()) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...plain,
    id: String(plain._id),
    deliverableId: String(plain.deliverableId),
    projectId: String(plain.projectId),
    submittedBy: String(plain.submittedBy),
    submittedByName: userMap.get(String(plain.submittedBy))?.name || '',
    files: (plain.files || []).map((f) => ({
      ...f,
      signedUrl: getSignedDeliveryUrl(f),
    })),
    review: plain.review
      ? {
          ...plain.review,
          reviewerId: String(plain.review.reviewerId),
          reviewerName: userMap.get(String(plain.review.reviewerId))?.name || '',
        }
      : null,
  };
}

export async function createSubmission(projectId, deliverableId, payload, { actor }) {
  const project = await getProjectForTracking(projectId, { requireWritable: true });
  const deliverableCheck = await Deliverable.findOne({ _id: deliverableId, projectId }).lean();
  if (!deliverableCheck) {
    throw AppError.notFound();
  }
  if (deliverableCheck.latestStatus === DELIVERABLE_STATUSES.APPROVED) {
    throw new AppError('DELIVERABLE_ALREADY_APPROVED');
  }

  const verifiedFiles = [];
  for (const file of payload.files || []) {
    const ref = await verifyUpload(file, {
      userId: actor.id,
      expectedPurpose: 'deliverable',
      expectedProjectId: projectId,
    });
    verifiedFiles.push(ref);
  }

  const session = await mongoose.startSession();
  try {
    let createdSubmission;
    await session.withTransaction(async () => {
      const deliverable = await Deliverable.findOne({ _id: deliverableId, projectId }).session(session);
      if (!deliverable) throw AppError.notFound();
      if (deliverable.latestStatus === DELIVERABLE_STATUSES.APPROVED) {
        throw new AppError('DELIVERABLE_ALREADY_APPROVED');
      }

      const latest = await Submission.findOne({ deliverableId })
        .sort({ version: -1 })
        .select('version')
        .session(session)
        .lean();
      const nextVersion = (latest?.version || 0) + 1;

      await Submission.updateMany(
        { deliverableId, isLatest: true },
        { $set: { isLatest: false } },
        { session }
      );

      const submittedAt = new Date();
      const isLate = submittedAt > new Date(deliverable.dueDate);

      const [sub] = await Submission.create(
        [
          {
            deliverableId,
            projectId,
            collegeId: project.collegeId,
            academicYearId: project.academicYearId,
            academicYearLabel: project.academicYearLabel,
            version: nextVersion,
            isLatest: true,
            files: verifiedFiles,
            links: payload.links || [],
            note: payload.note,
            submittedBy: actor.id,
            submittedAt,
            isLate,
          },
        ],
        { session }
      );

      deliverable.latestSubmissionId = sub._id;
      deliverable.latestStatus = DELIVERABLE_STATUSES.SUBMITTED;
      await deliverable.save({ session });

      await logTimelineEvent({
        projectId,
        type: 'submission_uploaded',
        actorId: actor.id,
        refType: 'submission',
        refId: sub._id,
        summaryKey: 'timeline.submissionUploaded',
        data: { title: deliverable.title, version: nextVersion, isLate },
        session,
      });

      createdSubmission = sub;
    });

    if (project.supervision?.primaryId) {
      await sendNotification({
        userId: project.supervision.primaryId,
        type: 'submission_uploaded',
        titleKey: 'timeline.submissionUploaded',
        bodyKey: 'timeline.submissionUploaded',
        vars: { title: deliverableCheck.title, project: project.title },
        link: `/app/projects/${projectId}`,
      });
    }

    const userMap = await findUsersBasicByIds([actor.id]);
    return formatSubmission(createdSubmission, userMap);
  } finally {
    await session.endSession();
  }
}

export async function listDeliverableSubmissions(projectId, deliverableId) {
  await getProjectForTracking(projectId);
  const exists = await Deliverable.exists({ _id: deliverableId, projectId });
  if (!exists) {
    throw AppError.notFound();
  }

  const submissions = await Submission.find({ deliverableId, projectId })
    .sort({ version: -1 })
    .lean();

  const userIds = [];
  for (const s of submissions) {
    userIds.push(s.submittedBy);
    if (s.review?.reviewerId) userIds.push(s.review.reviewerId);
  }
  const userMap = await findUsersBasicByIds(userIds);
  return submissions.map((s) => formatSubmission(s, userMap));
}

export async function reviewSubmission(submissionId, { decision, comment }, { actor, ip }) {
  if (decision !== 'approved' && !comment?.trim()) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'comment', code: 'validation.required', message: t('validation.required') }],
    });
  }

  const session = await mongoose.startSession();
  try {
    let result;
    let notifyRecipients = [];
    let deliverableTitle = '';
    let projectTitle = '';
    let projectIdStr = '';

    await session.withTransaction(async () => {
      const submission = await Submission.findById(submissionId).session(session);
      if (!submission) throw AppError.notFound();

      const project = await getProjectForTracking(submission.projectId, {
        requireWritable: true,
        session,
      });
      const deliverable = await Deliverable.findById(submission.deliverableId).session(session);
      if (!deliverable) throw AppError.notFound();

      const wasApproved = deliverable.latestStatus === DELIVERABLE_STATUSES.APPROVED;
      const isRevocation = wasApproved && decision !== 'approved';
      if (isRevocation) {
        assertDefenseNotScheduled(project.defenseState);
      }

      const reviewEntry = {
        decision,
        comment: comment?.trim() || undefined,
        reviewerId: actor.id,
        at: new Date(),
      };
      submission.review = reviewEntry;
      submission.reviewHistory.push(reviewEntry);
      await submission.save({ session });

      if (String(deliverable.latestSubmissionId) === String(submission._id) || submission.isLatest) {
        deliverable.latestStatus = decision;
        await deliverable.save({ session });
      }

      const progress = await recalculateProjectProgress(project._id, {
        regressDefenseIfEligible: isRevocation,
        session,
      });

      if (isRevocation) {
        await recordAudit({
          actorId: actor.id,
          actorRole: getActorRoleName(actor),
          action: 'submission.revoke_approval',
          targetType: 'submission',
          targetId: submission._id,
          scope: {
            collegeId: project.collegeId,
            departmentId: project.departmentId,
            projectId: project._id,
          },
          before: { latestStatus: DELIVERABLE_STATUSES.APPROVED },
          after: { latestStatus: decision },
          reason: comment,
          ip,
          session,
        });
      }

      await logTimelineEvent({
        projectId: project._id,
        type: 'submission_reviewed',
        actorId: actor.id,
        refType: 'submission',
        refId: submission._id,
        summaryKey: 'timeline.submissionReviewed',
        data: { title: deliverable.title, decision, version: submission.version },
        session,
      });

      notifyRecipients = (project.activeMemberIds || []).map(String);
      deliverableTitle = deliverable.title;
      projectTitle = project.title;
      projectIdStr = String(project._id);
      result = {
        submission: formatSubmission(submission),
        progress,
      };
    });

    if (notifyRecipients.length > 0) {
      await sendBulkNotifications(
        notifyRecipients.map((userId) => ({
          userId,
          type: 'submission_reviewed',
          titleKey: 'timeline.submissionReviewed',
          bodyKey: 'timeline.submissionReviewed',
          vars: { title: deliverableTitle, project: projectTitle, decision },
          link: `/app/projects/${projectIdStr}`,
        }))
      );
    }

    return result;
  } finally {
    await session.endSession();
  }
}
