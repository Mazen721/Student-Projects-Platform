import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { CommentThread } from '@/features/collaboration/CommentThread';
import { PROPOSAL_STATUSES, TASK_COLUMN_VALUES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatNumber } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useTasksQuery,
  useUpdateTaskMutation,
} from './trackingApi';

function TaskCard({ task, canWrite, onMove, onDelete, onOpenComments }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canWrite,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-line bg-white p-3 shadow-xs space-y-2 ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          {...(canWrite ? { ...attributes, ...listeners } : {})}
          className="cursor-grab text-sm font-bold text-navy"
        >
          {task.title}
        </p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={ar.chat.commentsTitle}
            onClick={() => onOpenComments(task)}
          >
            <MessageSquare className="h-4 w-4 text-navy" aria-hidden="true" />
          </Button>
          {canWrite && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={ar.common.delete}
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-4 w-4 text-[#b91c1c]" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {task.description && <p className="text-xs text-muted">{task.description}</p>}
      {task.dueDate && (
        <p className="text-xs text-muted">
          {ar.tracking.dueDate}
          {': '}
          {formatDate(task.dueDate)}
        </p>
      )}

      {canWrite && (
        <Select
          aria-label={ar.tracking.moveTaskTo}
          value={task.column}
          onChange={(e) => onMove(task.id, e.target.value)}
        >
          {TASK_COLUMN_VALUES.map((col) => (
            <option key={col} value={col}>
              {t(`tracking.columns.${col}`)}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

function KanbanColumn({ columnKey, tasks, canWrite, onMove, onDelete, onOpenComments }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border border-line bg-app-bg p-3 space-y-3 min-h-[220px] ${
        isOver ? 'ring-2 ring-gold' : ''
      }`}
    >
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h3 className="text-sm font-extrabold text-navy">{t(`tracking.columns.${columnKey}`)}</h3>
        <Badge tone="info">{formatNumber(tasks.length)}</Badge>
      </div>

      {tasks.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">{ar.tracking.noTasksInColumn}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canWrite={canWrite}
              onMove={onMove}
              onDelete={onDelete}
              onOpenComments={onOpenComments}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function KanbanBoardPage({ project }) {
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const { data, isLoading } = useTasksQuery(project.id);
  const createTask = useCreateTaskMutation();
  const updateTask = useUpdateTaskMutation();
  const deleteTask = useDeleteTaskMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [commentTask, setCommentTask] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [column, setColumn] = useState('todo');
  const [dueDate, setDueDate] = useState('');

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const isTeamMember = (project.activeMemberIds || []).includes(String(user?.id));
  const canWrite = isTeamMember && project.status !== PROPOSAL_STATUSES.ARCHIVED;

  if (isLoading) return <CardSkeleton />;

  const columns = data?.columns || { todo: [], in_progress: [], review: [], done: [] };

  async function moveTask(taskId, targetColumn) {
    try {
      await updateTask.mutateAsync({
        taskId,
        projectId: project.id,
        column: targetColumn,
      });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function removeTask(taskId) {
    try {
      await deleteTask.mutateAsync({ taskId, projectId: project.id });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || !TASK_COLUMN_VALUES.includes(String(over.id))) return;
    const task = (data?.tasks || []).find((tItem) => tItem.id === String(active.id));
    if (task && task.column !== String(over.id)) {
      moveTask(task.id, String(over.id));
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    try {
      await createTask.mutateAsync({
        projectId: project.id,
        title,
        ...(description.trim() ? { description: description.trim() } : {}),
        column,
        ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
      });
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title={ar.tracking.kanban}
        actions={
          canWrite ? (
            <Button variant="gold" size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{ar.tracking.newTask}</span>
            </Button>
          ) : null
        }
      >
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {TASK_COLUMN_VALUES.map((col) => (
              <KanbanColumn
                key={col}
                columnKey={col}
                tasks={columns[col] || []}
                canWrite={canWrite}
                onMove={moveTask}
                onDelete={removeTask}
                onOpenComments={setCommentTask}
              />
            ))}
          </div>
        </DndContext>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={ar.tracking.newTask}>
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Field label={ar.tracking.taskTitle} id="task-title" required>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>
          <Field label={ar.tracking.taskDescription} id="task-desc">
            <Textarea
              id="task-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={ar.common.status} id="task-col">
              <Select id="task-col" value={column} onChange={(e) => setColumn(e.target.value)}>
                {TASK_COLUMN_VALUES.map((col) => (
                  <option key={col} value={col}>
                    {t(`tracking.columns.${col}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={ar.tracking.dueDate} id="task-due">
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={createTask.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(commentTask)}
        onClose={() => setCommentTask(null)}
        title={commentTask?.title || ar.chat.commentsTitle}
      >
        {commentTask && <CommentThread targetType="task" targetId={commentTask.id} />}
      </Modal>
    </div>
  );
}
