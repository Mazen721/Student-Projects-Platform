import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ACADEMIC_YEAR_STATUSES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  CardSkeleton,
  Field,
  Input,
  Modal,
  ResponsiveTable,
} from '@/components/ui';
import {
  useAcademicYearsQuery,
  useCreateAcademicYearMutation,
  useRolloverYearMutation,
  useSetCurrentYearMutation,
} from './orgApi';

export default function AcademicYearsPage() {
  const { collegeId } = useParams();
  const addToast = useUiStore((s) => s.addToast);
  const { data: years = [], isLoading, refetch } = useAcademicYearsQuery(collegeId);
  const createYear = useCreateAcademicYearMutation();
  const setCurrent = useSetCurrentYearMutation();
  const rollover = useRolloverYearMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [rolloverTarget, setRolloverTarget] = useState(null);
  const [form, setForm] = useState({
    label: '2026/2027',
    startDate: '',
    endDate: '',
    registrationOpensAt: '',
    registrationClosesAt: '',
    proposalDeadline: '',
  });

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await createYear.mutateAsync({
        collegeId,
        label: form.label,
        startDate: form.startDate,
        endDate: form.endDate,
        cycle: {
          registrationOpensAt: form.registrationOpensAt,
          registrationClosesAt: form.registrationClosesAt,
          proposalDeadline: form.proposalDeadline,
        },
      });
      await refetch();
      setCreateOpen(false);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleSetCurrent(id) {
    try {
      await setCurrent.mutateAsync(id);
      await refetch();
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleRollover() {
    try {
      await rollover.mutateAsync(rolloverTarget._id);
      await refetch();
      setRolloverTarget(null);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const columns = [
    {
      key: 'label',
      header: ar.org.academicYears,
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <span dir="ltr" className="font-extrabold text-navy [unicode-bidi:isolate]">
            {row.label}
          </span>
          {row.isCurrent && <Badge tone="featured">{ar.org.currentYearBadge}</Badge>}
        </div>
      ),
    },
    {
      key: 'registrationClosesAt',
      header: ar.org.registrationClosesAt,
      render: (row) => formatDate(row.cycle?.registrationClosesAt),
    },
    {
      key: 'proposalDeadline',
      header: ar.org.proposalDeadline,
      render: (row) => formatDate(row.cycle?.proposalDeadline),
    },
    {
      key: 'status',
      header: ar.common.status,
      render: (row) => (
        <Badge tone={row.status === ACADEMIC_YEAR_STATUSES.ACTIVE ? 'success' : 'info'}>
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: ar.common.actions,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.status === ACADEMIC_YEAR_STATUSES.ACTIVE && !row.isCurrent && (
            <Button size="sm" variant="navy" onClick={() => handleSetCurrent(row._id)}>
              {ar.org.setCurrentYear}
            </Button>
          )}
          {row.status === ACADEMIC_YEAR_STATUSES.ACTIVE && (
            <Button size="sm" variant="danger" onClick={() => setRolloverTarget(row)}>
              {ar.org.rolloverYear}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.org.academicYears} — ${ar.common.platformName}`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link to="/app/organization" className="text-xs font-bold text-muted underline">
            {ar.common.back}
          </Link>
          <h1 className="text-2xl font-extrabold text-navy">{ar.org.academicYears}</h1>
        </div>
        <Button variant="gold" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{ar.org.addAcademicYear}</span>
        </Button>
      </div>

      {isLoading ? <CardSkeleton /> : <ResponsiveTable columns={columns} rows={years} />}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={ar.org.addAcademicYear}>
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label={ar.org.yearLabel} id="ay-label" required>
            <Input
              id="ay-label"
              dir="ltr"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={ar.org.startDate} id="ay-start" required>
              <Input
                id="ay-start"
                type="date"
                dir="ltr"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </Field>
            <Field label={ar.org.endDate} id="ay-end" required>
              <Input
                id="ay-end"
                type="date"
                dir="ltr"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </Field>
            <Field label={ar.org.registrationOpensAt} id="ay-ropen" required>
              <Input
                id="ay-ropen"
                type="date"
                dir="ltr"
                value={form.registrationOpensAt}
                onChange={(e) => setForm((f) => ({ ...f, registrationOpensAt: e.target.value }))}
              />
            </Field>
            <Field label={ar.org.registrationClosesAt} id="ay-rclose" required>
              <Input
                id="ay-rclose"
                type="date"
                dir="ltr"
                value={form.registrationClosesAt}
                onChange={(e) => setForm((f) => ({ ...f, registrationClosesAt: e.target.value }))}
              />
            </Field>
          </div>
          <Field label={ar.org.proposalDeadline} id="ay-pdead" required>
            <Input
              id="ay-pdead"
              type="date"
              dir="ltr"
              value={form.proposalDeadline}
              onChange={(e) => setForm((f) => ({ ...f, proposalDeadline: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={createYear.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(rolloverTarget)}
        onClose={() => setRolloverTarget(null)}
        title={ar.org.rolloverYear}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink">{ar.org.rolloverConfirm}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRolloverTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button variant="danger" loading={rollover.isPending} onClick={handleRollover}>
              {ar.common.confirm}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
