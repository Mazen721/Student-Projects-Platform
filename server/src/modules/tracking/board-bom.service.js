import mongoose from 'mongoose';
import { TASK_COLUMN_VALUES } from '@spp/shared/constants';
import { computeBudget } from '@spp/shared/calc';
import { AppError } from '../../core/errors/AppError.js';
import { findUsersBasicByIds } from '../auth/index.js';
import { getProjectForTracking, updateProjectBudget } from '../projects/index.js';
import BOMItem from './bomItem.model.js';
import Deliverable from './deliverable.model.js';
import Meeting from './meeting.model.js';
import Submission from './submission.model.js';
import Task from './task.model.js';
import { logTimelineEvent } from './timeline.service.js';
import ToolItem from './toolItem.model.js';

function serializeTask(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...plain,
    id: String(plain._id),
    projectId: String(plain.projectId),
    assigneeIds: (plain.assigneeIds || []).map(String),
    createdBy: String(plain.createdBy),
    sourceMeetingId: plain.sourceMeetingId ? String(plain.sourceMeetingId) : null,
  };
}

export async function listTasks(projectId) {
  await getProjectForTracking(projectId);
  const docs = await Task.find({ projectId }).sort({ order: 1, createdAt: 1 }).lean();
  const columns = Object.fromEntries(TASK_COLUMN_VALUES.map((col) => [col, []]));
  for (const doc of docs) {
    const serialized = serializeTask(doc);
    if (columns[serialized.column]) {
      columns[serialized.column].push(serialized);
    }
  }
  return { tasks: docs.map(serializeTask), columns };
}

export async function createTask(projectId, payload, { actor }) {
  await getProjectForTracking(projectId, { requireWritable: true });
  const task = await Task.create({
    projectId,
    title: payload.title,
    description: payload.description,
    column: payload.column || 'todo',
    order: `z${Date.now()}`,
    assigneeIds: payload.assigneeIds || [],
    dueDate: payload.dueDate,
    createdBy: actor.id,
  });
  return serializeTask(task);
}

export async function updateTask(taskId, payload) {
  const existing = await Task.findById(taskId);
  if (!existing) throw AppError.notFound();
  await getProjectForTracking(existing.projectId, { requireWritable: true });

  const fields = ['title', 'description', 'column', 'order', 'assigneeIds', 'dueDate'];
  for (const field of fields) {
    if (payload[field] !== undefined) {
      existing[field] = payload[field];
    }
  }
  await existing.save();
  return serializeTask(existing);
}

export async function deleteTask(taskId) {
  const existing = await Task.findById(taskId);
  if (!existing) throw AppError.notFound();
  await getProjectForTracking(existing.projectId, { requireWritable: true });
  await Task.deleteOne({ _id: taskId });
}

function serializeBom(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...plain,
    id: String(plain._id),
    projectId: String(plain.projectId),
  };
}

async function syncProjectBudget(projectId, session = null) {
  const query = BOMItem.find({ projectId }).select('quantity unitPrice');
  if (session) query.session(session);
  const items = await query.lean();
  const budgetEstimate = computeBudget(items);
  await updateProjectBudget(projectId, budgetEstimate, { session });
  return budgetEstimate;
}

export async function listBom(projectId) {
  const project = await getProjectForTracking(projectId);
  const items = await BOMItem.find({ projectId }).sort({ createdAt: 1 }).lean();
  return {
    items: items.map(serializeBom),
    budgetEstimate: computeBudget(items) ?? project.budgetEstimate ?? 0,
  };
}

export async function createBomItem(projectId, payload) {
  const project = await getProjectForTracking(projectId, { requireWritable: true });
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const [item] = await BOMItem.create(
        [
          {
            ...payload,
            projectId,
            collegeId: project.collegeId,
            academicYearId: project.academicYearId,
            academicYearLabel: project.academicYearLabel,
          },
        ],
        { session }
      );
      const budgetEstimate = await syncProjectBudget(projectId, session);
      result = { item: serializeBom(item), budgetEstimate };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function updateBomItem(itemId, payload) {
  const existing = await BOMItem.findById(itemId).lean();
  if (!existing) throw AppError.notFound();
  await getProjectForTracking(existing.projectId, { requireWritable: true });

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const doc = await BOMItem.findById(itemId).session(session);
      const fields = ['item', 'quantity', 'specs', 'unitPrice', 'supplier', 'status'];
      for (const field of fields) {
        if (payload[field] !== undefined) doc[field] = payload[field];
      }
      await doc.save({ session });
      const budgetEstimate = await syncProjectBudget(existing.projectId, session);
      result = { item: serializeBom(doc), budgetEstimate };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function deleteBomItem(itemId) {
  const existing = await BOMItem.findById(itemId).lean();
  if (!existing) throw AppError.notFound();
  await getProjectForTracking(existing.projectId, { requireWritable: true });

  const session = await mongoose.startSession();
  try {
    let budgetEstimate = 0;
    await session.withTransaction(async () => {
      await BOMItem.deleteOne({ _id: itemId }, { session });
      budgetEstimate = await syncProjectBudget(existing.projectId, session);
    });
    return { budgetEstimate };
  } finally {
    await session.endSession();
  }
}

export async function listTools(projectId) {
  await getProjectForTracking(projectId);
  const items = await ToolItem.find({ projectId }).sort({ createdAt: 1 }).lean();
  return items.map((t) => ({ ...t, id: String(t._id), projectId: String(t.projectId) }));
}

export async function createToolItem(projectId, payload) {
  const project = await getProjectForTracking(projectId, { requireWritable: true });
  const tool = await ToolItem.create({
    ...payload,
    projectId,
    collegeId: project.collegeId,
    academicYearId: project.academicYearId,
    academicYearLabel: project.academicYearLabel,
  });
  return { ...tool.toObject(), id: String(tool._id), projectId: String(tool.projectId) };
}

export async function deleteToolItem(toolId) {
  const existing = await ToolItem.findById(toolId).lean();
  if (!existing) throw AppError.notFound();
  await getProjectForTracking(existing.projectId, { requireWritable: true });
  await ToolItem.deleteOne({ _id: toolId });
}

export async function listMeetings(projectId) {
  await getProjectForTracking(projectId);
  const meetings = await Meeting.find({ projectId }).sort({ date: -1 }).lean();
  const userIds = meetings.flatMap((m) => [m.createdBy, ...(m.attendeeIds || [])]);
  const userMap = await findUsersBasicByIds(userIds);

  return meetings.map((m) => ({
    ...m,
    id: String(m._id),
    projectId: String(m.projectId),
    createdBy: String(m.createdBy),
    createdByName: userMap.get(String(m.createdBy))?.name || '',
    attendees: (m.attendeeIds || []).map((id) => ({
      id: String(id),
      name: userMap.get(String(id))?.name || '',
    })),
    actionItems: (m.actionItems || []).map((a) => ({
      ...a,
      assigneeId: a.assigneeId ? String(a.assigneeId) : null,
      taskId: a.taskId ? String(a.taskId) : null,
    })),
  }));
}

export async function createMeeting(projectId, payload, { actor }) {
  await getProjectForTracking(projectId, { requireWritable: true });
  const meeting = await Meeting.create({
    projectId,
    date: payload.date,
    attendeeIds: payload.attendeeIds,
    notes: payload.notes,
    actionItems: payload.actionItems || [],
    createdBy: actor.id,
  });

  await logTimelineEvent({
    projectId,
    type: 'meeting_logged',
    actorId: actor.id,
    refType: 'meeting',
    refId: meeting._id,
    summaryKey: 'timeline.meetingLogged',
    data: { date: meeting.date },
  });

  return { ...meeting.toObject(), id: String(meeting._id), projectId: String(meeting.projectId) };
}

export async function convertActionItemToTask(meetingId, index, { actor }) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw AppError.notFound();
  await getProjectForTracking(meeting.projectId, { requireWritable: true });

  const idx = Number(index);
  const item = meeting.actionItems?.[idx];
  if (!item) throw AppError.notFound();

  if (item.taskId) {
    const existingTask = await Task.findById(item.taskId).lean();
    if (existingTask) return serializeTask(existingTask);
  }

  const session = await mongoose.startSession();
  try {
    let createdTask;
    await session.withTransaction(async () => {
      const [task] = await Task.create(
        [
          {
            projectId: meeting.projectId,
            title: item.text,
            column: 'todo',
            order: `z${Date.now()}`,
            assigneeIds: item.assigneeId ? [item.assigneeId] : [],
            createdBy: actor.id,
            sourceMeetingId: meeting._id,
          },
        ],
        { session }
      );
      meeting.actionItems[idx].taskId = task._id;
      await meeting.save({ session });
      createdTask = task;
    });
    return serializeTask(createdTask);
  } finally {
    await session.endSession();
  }
}

const TARGET_MODEL_MAP = {
  submission: Submission,
  deliverable: Deliverable,
  task: Task,
};

export async function getCommentTargetProjectId(targetType, targetId) {
  const Model = TARGET_MODEL_MAP[targetType];
  if (!Model) throw AppError.notFound();
  const doc = await Model.findById(targetId).select('projectId').lean();
  if (!doc) throw AppError.notFound();
  return String(doc.projectId);
}
