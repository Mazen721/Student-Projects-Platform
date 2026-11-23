import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, Copy, UserPlus } from 'lucide-react';
import { DEFENSE_STATES, ROLES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
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
  ResponsiveTable,
  Select,
} from '@/components/ui';
import {
  useAvailableExaminersQuery,
  useDefenseEligibilityQuery,
  useDefensesQuery,
  useInviteExternalExaminerMutation,
  useScheduleDefenseMutation,
  useSignOffDefenseMutation,
} from './evaluationApi';

const ADMIN_ROLES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

function getDefenseTone(state) {
  if (state === DEFENSE_STATES.FINALIZED) return 'success';
  if (state === DEFENSE_STATES.ELIGIBLE || state === DEFENSE_STATES.SCHEDULED) return 'info';
  if (
    state === DEFENSE_STATES.DELIBERATION ||
    state === DEFENSE_STATES.REEVALUATION_REQUESTED ||
    state === DEFENSE_STATES.REEVALUATION_OPEN
  ) {
    return 'warning';
  }
  return 'default';
}

export function ProjectDefensePanel({ project }) {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const isPrimarySup = String(project.supervision?.primaryId || '') === String(user?.id || '');
  const isAdmin = roles.some((r) => ADMIN_ROLES.has(r.role));

  const { data: eligibility, isLoading } = useDefenseEligibilityQuery(project.id);
  const { data: examiners = [] } = useAvailableExaminersQuery(project.id, isAdmin);
  const signOffMutation = useSignOffDefenseMutation();
  const scheduleMutation = useScheduleDefenseMutation();
  const inviteExternalMutation = useInviteExternalExaminerMutation();

  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [room, setRoom] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [chairId, setChairId] = useState('');
  const [memberIds, setMemberIds] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [ackConflicts, setAckConflicts] = useState(false);

  const [extModalOpen, setExtModalOpen] = useState(false);
  const [extName, setExtName] = useState('');
  const [extUrl, setExtUrl] = useState('');

  if (isLoading || !eligibility) {
    return <CardSkeleton />;
  }

  async function handleSignOff() {
    try {
      await signOffMutation.mutateAsync(project.id);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  function toggleMember(id) {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSchedule(e) {
    e.preventDefault();
    setConflicts([]);
    try {
      await scheduleMutation.mutateAsync({
        projectId: project.id,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMin: Number(durationMin),
        ...(room.trim() ? { room: room.trim() } : {}),
        ...(meetingLink.trim() ? { meetingLink: meetingLink.trim() } : {}),
        committee: {
          chairId,
          memberIds: memberIds.filter((id) => id !== chairId),
        },
        ...(ackConflicts ? { acknowledgeConflicts: true } : {}),
      });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      const conflictList = err?.response?.data?.error?.details?.conflicts;
      if (Array.isArray(conflictList) && conflictList.length > 0) {
        setConflicts(conflictList);
      }
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleInviteExternal(e) {
    e.preventDefault();
    try {
      const res = await inviteExternalMutation.mutateAsync({
        defenseId: eligibility.defenseId,
        name: extName,
      });
      const fullUrl = `${window.location.origin}${res.url}`;
      setExtUrl(fullUrl);
      setExtName('');
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function copyExternalUrl() {
    await navigator.clipboard.writeText(extUrl);
    addToast({ message: ar.org.inviteCopied, tone: 'success' });
  }

  return (
    <div className="space-y-4">
      <Card
        title={ar.evaluation.eligibilityTitle}
        actions={
          <Badge tone={getDefenseTone(eligibility.defenseState)}>
            {t(`statuses.${eligibility.defenseState}`)}
          </Badge>
        }
      >
        <div className="space-y-4">
          {!eligibility.allPhasesApproved && eligibility.missingPhases?.length > 0 && (
            <div className="rounded-xl bg-[#fef3c7] p-4 space-y-2">
              <p className="text-sm font-bold text-[#b45309]">
                {ar.evaluation.missingPhasesLabel}
              </p>
              <ul className="list-disc space-y-1 ps-5 text-xs text-ink">
                {eligibility.missingPhases.map((mp) => (
                  <li key={mp.phaseId}>{mp.name}</li>
                ))}
              </ul>
            </div>
          )}

          {isPrimarySup && eligibility.defenseState === DEFENSE_STATES.NOT_ELIGIBLE && (
            <Button
              variant="gold"
              onClick={handleSignOff}
              loading={signOffMutation.isPending}
              disabled={!eligibility.allPhasesApproved}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>{ar.evaluation.signOffAction}</span>
            </Button>
          )}

          {eligibility.defenseId && (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/app/defenses/${eligibility.defenseId}/grading`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light"
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <span>{ar.evaluation.scoresheet}</span>
              </Link>
              {isAdmin && eligibility.defenseState !== DEFENSE_STATES.FINALIZED && (
                <Button variant="outline" onClick={() => setExtModalOpen(true)}>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>{ar.evaluation.inviteExternalExaminer}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {isAdmin && eligibility.defenseState === DEFENSE_STATES.ELIGIBLE && (
        <Card title={ar.evaluation.scheduleDefense}>
          <form onSubmit={handleSchedule} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={ar.evaluation.scheduledAt} id="def-date" required>
                <Input
                  id="def-date"
                  type="datetime-local"
                  dir="ltr"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                />
              </Field>
              <Field label={ar.evaluation.durationMin} id="def-dur" required>
                <Input
                  id="def-dur"
                  type="number"
                  min="15"
                  max="240"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  required
                />
              </Field>
              <Field label={ar.evaluation.room} id="def-room">
                <Input id="def-room" value={room} onChange={(e) => setRoom(e.target.value)} />
              </Field>
              <Field label={ar.evaluation.meetingLink} id="def-link">
                <Input
                  id="def-link"
                  type="url"
                  dir="ltr"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                />
              </Field>
            </div>

            <Field label={ar.evaluation.chairLabel} id="def-chair" required>
              <Select
                id="def-chair"
                value={chairId}
                onChange={(e) => setChairId(e.target.value)}
                required
              >
                <option value="">{ar.common.selectPlaceholder}</option>
                {examiners.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="space-y-2">
              <span className="block text-sm font-bold text-navy">
                {ar.evaluation.membersLabel}
              </span>
              <div className="flex flex-wrap gap-2">
                {examiners
                  .filter((ex) => ex.id !== chairId)
                  .map((ex) => (
                    <label
                      key={ex.id}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-app-bg px-3 py-2 text-xs font-bold text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={memberIds.includes(ex.id)}
                        onChange={() => toggleMember(ex.id)}
                        className="h-4 w-4 accent-navy"
                      />
                      <span>{ex.name}</span>
                    </label>
                  ))}
              </div>
            </div>

            {conflicts.length > 0 && (
              <div role="alert" className="rounded-xl bg-[#fef3c7] p-4 space-y-2">
                <p className="text-sm font-bold text-[#b45309]">
                  {ar.evaluation.conflictWarningTitle}
                </p>
                <label className="flex items-center gap-2 text-xs font-bold text-navy">
                  <input
                    type="checkbox"
                    checked={ackConflicts}
                    onChange={(e) => setAckConflicts(e.target.checked)}
                    className="h-4 w-4 accent-navy"
                  />
                  <span>{ar.evaluation.acknowledgeConflictsLabel}</span>
                </label>
              </div>
            )}

            <Button type="submit" variant="navy" loading={scheduleMutation.isPending}>
              {ar.evaluation.scheduleDefense}
            </Button>
          </form>
        </Card>
      )}

      <Modal
        open={extModalOpen}
        onClose={() => setExtModalOpen(false)}
        title={ar.evaluation.inviteExternalExaminer}
      >
        <form onSubmit={handleInviteExternal} className="space-y-4">
          <Field label={ar.evaluation.externalExaminerName} id="ext-name" required>
            <Input
              id="ext-name"
              value={extName}
              onChange={(e) => setExtName(e.target.value)}
              required
            />
          </Field>
          {extUrl && (
            <div className="rounded-xl border border-line bg-app-bg p-3 space-y-2">
              <p className="text-xs font-bold text-navy">{ar.evaluation.externalInviteReady}</p>
              <div className="flex items-center justify-between gap-2">
                <span dir="ltr" className="truncate text-xs text-muted [unicode-bidi:isolate]">
                  {extUrl}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={copyExternalUrl}>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{ar.org.copyInviteUrl}</span>
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExtModalOpen(false)}>
              {ar.common.close}
            </Button>
            <Button type="submit" variant="gold" loading={inviteExternalMutation.isPending}>
              {ar.org.createInvite}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function DefenseSchedulingPage() {
  const { data, isLoading } = useDefensesQuery({ limit: 50 });
  const items = data?.data || [];

  const columns = [
    {
      key: 'projectTitle',
      header: ar.projects.title,
      render: (row) => (
        <Link to={`/app/projects/${row.projectId}`} className="font-bold text-navy underline">
          {row.projectTitle}
        </Link>
      ),
    },
    {
      key: 'scheduledAt',
      header: ar.evaluation.scheduledAt,
      render: (row) => formatDateTime(row.scheduledAt),
    },
    {
      key: 'room',
      header: ar.evaluation.room,
      render: (row) =>
        row.room || (
          <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
            {row.meetingLink}
          </span>
        ),
    },
    {
      key: 'chairName',
      header: ar.evaluation.chairLabel,
    },
    {
      key: 'state',
      header: ar.common.status,
      render: (row) => (
        <Badge tone={getDefenseTone(row.state)}>{t(`statuses.${row.state}`)}</Badge>
      ),
    },
    {
      key: 'actions',
      header: ar.common.actions,
      render: (row) => (
        <Link
          to={`/app/defenses/${row.id}/grading`}
          className="inline-flex min-h-11 items-center rounded-xl bg-gold px-3 py-1.5 text-xs font-extrabold text-navy hover:bg-gold-light"
        >
          {ar.evaluation.scoresheet}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.evaluation.defenseCalendar} — ${ar.common.platformName}`} />

      <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.evaluation.defenseCalendar}</h1>
      </header>

      {isLoading ? (
        <CardSkeleton />
      ) : items.length === 0 ? (
        <EmptyState title={ar.evaluation.defenseCalendar} />
      ) : (
        <Card>
          <ResponsiveTable columns={columns} rows={items} />
        </Card>
      )}
    </div>
  );
}
