import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { PROPOSAL_STATUSES } from '@spp/shared/constants';
import ar from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  Field,
  Input,
  Modal,
  Textarea,
} from '@/components/ui';
import {
  useConvertActionItemMutation,
  useCreateMeetingMutation,
  useMeetingsQuery,
} from './trackingApi';

export function MeetingsPage({ project }) {
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const { data: meetings = [], isLoading } = useMeetingsQuery(project.id);
  const createMeeting = useCreateMeetingMutation();
  const convertActionItem = useConvertActionItemMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [actionItems, setActionItems] = useState([{ text: '' }]);

  const isTeamMember = (project.activeMemberIds || []).includes(String(user?.id));
  const isSupervisor = (project.supervisorIds || []).map(String).includes(String(user?.id));
  const canWrite = (isTeamMember || isSupervisor) && project.status !== PROPOSAL_STATUSES.ARCHIVED;

  if (isLoading) return <CardSkeleton />;

  async function handleCreateMeeting(e) {
    e.preventDefault();
    const attendeeIds = [
      ...(project.activeMemberIds || []),
      ...(project.supervisorIds || []).map(String),
    ];
    const uniqueAttendees = Array.from(new Set(attendeeIds));
    try {
      await createMeeting.mutateAsync({
        projectId: project.id,
        date: new Date(date).toISOString(),
        attendeeIds: uniqueAttendees.length > 0 ? uniqueAttendees : [String(user.id)],
        notes,
        actionItems: actionItems
          .filter((a) => a.text.trim().length >= 2)
          .map((a) => ({ text: a.text.trim() })),
      });
      setModalOpen(false);
      setDate('');
      setNotes('');
      setActionItems([{ text: '' }]);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleConvert(meetingId, index) {
    try {
      await convertActionItem.mutateAsync({ meetingId, index, projectId: project.id });
      addToast({ message: ar.tracking.convertedToTask, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title={ar.tracking.meetings}
        actions={
          canWrite ? (
            <Button variant="gold" size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{ar.tracking.newMeeting}</span>
            </Button>
          ) : null
        }
      >
        {meetings.length === 0 ? (
          <EmptyState title={ar.tracking.meetings} />
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="rounded-xl border border-line bg-app-bg p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-navy">{formatDateTime(meeting.date)}</span>
                  <span className="text-xs text-muted">{meeting.createdByName}</span>
                </div>
                <p className="whitespace-pre-line text-sm text-ink">{meeting.notes}</p>
                {(meeting.actionItems || []).length > 0 && (
                  <div className="space-y-2 border-t border-line pt-2">
                    <p className="text-xs font-bold text-muted">{ar.tracking.actionItems}</p>
                    {meeting.actionItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 border border-line"
                      >
                        <span className="text-sm text-ink">{item.text}</span>
                        {item.taskId ? (
                          <Badge tone="success">
                            <Check className="me-1 h-3 w-3" aria-hidden="true" />
                            <span>{ar.tracking.convertedToTask}</span>
                          </Badge>
                        ) : isTeamMember && project.status !== PROPOSAL_STATUSES.ARCHIVED ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConvert(meeting.id, idx)}
                          >
                            {ar.tracking.convertToTask}
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={ar.tracking.newMeeting}>
        <form onSubmit={handleCreateMeeting} className="space-y-4">
          <Field label={ar.tracking.meetingDate} id="meet-date" required>
            <Input
              id="meet-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field label={ar.tracking.meetingNotes} id="meet-notes" required>
            <Textarea
              id="meet-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
            />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-navy">{ar.tracking.actionItems}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActionItems((prev) => [...prev, { text: '' }])}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{ar.tracking.addActionItem}</span>
              </Button>
            </div>
            {actionItems.map((item, idx) => (
              <Input
                key={idx}
                aria-label={ar.tracking.actionItems}
                value={item.text}
                onChange={(e) =>
                  setActionItems((prev) =>
                    prev.map((a, i) => (i === idx ? { text: e.target.value } : a))
                  )
                }
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={createMeeting.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
