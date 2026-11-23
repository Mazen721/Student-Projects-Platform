import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { AlertTriangle, UserCheck } from 'lucide-react';
import { ROLES } from '@spp/shared/constants';
import ar from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
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
  ResponsiveTable,
  Select,
} from '@/components/ui';
import { useAcademicYearsQuery, useCollegesQuery } from '@/features/organization/orgApi';
import {
  useAssignSupervisionMutation,
  useProjectsQuery,
  useSupervisorsLoadQuery,
} from './projectsApi';

export default function SupervisorLoadPage() {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const canOverride = roles.some((r) =>
    [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN].includes(r.role)
  );

  const { data: collegesRes, isLoading: collegesLoading } = useCollegesQuery({ limit: 100 });
  const colleges = useMemo(() => collegesRes?.data || [], [collegesRes]);
  const [collegeId, setCollegeId] = useState(user?.collegeId || '');

  useEffect(() => {
    if (!collegeId && colleges.length > 0) {
      setCollegeId(colleges[0]._id);
    }
  }, [collegeId, colleges]);

  const { data: years = [] } = useAcademicYearsQuery(collegeId);
  const [academicYearId, setAcademicYearId] = useState('');

  useEffect(() => {
    const current = years.find((y) => y.isCurrent) || years[0];
    if (current && !years.some((y) => y._id === academicYearId)) {
      setAcademicYearId(current._id);
    }
  }, [years, academicYearId]);

  const { data: loadRows = [], isLoading: loadLoading } = useSupervisorsLoadQuery({
    academicYearId,
    collegeId,
  });
  const { data: projectsRes } = useProjectsQuery({ academicYearId, collegeId, limit: 100 });
  const assignMutation = useAssignSupervisionMutation();

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [primaryId, setPrimaryId] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  if (collegesLoading) {
    return <CardSkeleton />;
  }

  const projects = projectsRes?.data || [];
  const selectedSupervisor = loadRows.find((s) => s.supervisorId === primaryId);

  async function submitAssignment(reasonText) {
    try {
      await assignMutation.mutateAsync({
        projectId: selectedProjectId,
        primaryId: primaryId || null,
        reviewerId: reviewerId || null,
        ...(reasonText ? { overrideReason: reasonText } : {}),
      });
      setOverrideModalOpen(false);
      setOverrideReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  function handleAssignClick(e) {
    e.preventDefault();
    if (!selectedProjectId) return;
    if (selectedSupervisor?.isFull && canOverride) {
      setOverrideModalOpen(true);
      return;
    }
    submitAssignment('');
  }

  const columns = [
    { key: 'name', header: ar.auth.name },
    {
      key: 'primaryCount',
      header: ar.projects.primaryCount,
      render: (row) => `${formatNumber(row.primaryCount)} / ${formatNumber(row.cap)}`,
    },
    {
      key: 'coCount',
      header: ar.projects.coCount,
      render: (row) => formatNumber(row.coCount),
    },
    {
      key: 'remaining',
      header: ar.projects.remainingSlots,
      render: (row) =>
        row.isFull ? (
          <Badge tone="danger">{ar.projects.capacityFull}</Badge>
        ) : (
          <Badge tone="success">{formatNumber(row.remaining)}</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.projects.supervisorLoad} — ${ar.common.platformName}`} />

      <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.projects.supervisorLoad}</h1>
      </header>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={ar.auth.college} id="load-college">
            <Select
              id="load-college"
              placeholder={false}
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value)}
            >
              {colleges.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={ar.org.academicYears} id="load-year">
            <Select
              id="load-year"
              placeholder={false}
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y._id} value={y._id}>
                  {y.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {loadLoading ? (
        <CardSkeleton />
      ) : (
        <ResponsiveTable
          columns={columns}
          rows={loadRows}
          rowKey={(row) => row.supervisorId}
        />
      )}

      <Card title={ar.projects.assignSupervision}>
        <form onSubmit={handleAssignClick} className="grid gap-4 sm:grid-cols-3">
          <Field label={ar.nav.projects} id="assign-project" required>
            <Select
              id="assign-project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={ar.projects.primarySupervisor} id="assign-primary">
            <Select
              id="assign-primary"
              value={primaryId}
              onChange={(e) => setPrimaryId(e.target.value)}
            >
              {loadRows.map((s) => (
                <option key={s.supervisorId} value={s.supervisorId}>
                  {s.name} ({formatNumber(s.primaryCount)}/{formatNumber(s.cap)})
                </option>
              ))}
            </Select>
          </Field>

          <Field label={ar.projects.reviewingSupervisor} id="assign-reviewer">
            <Select
              id="assign-reviewer"
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
            >
              {loadRows.map((s) => (
                <option key={s.supervisorId} value={s.supervisorId}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-3 flex justify-end">
            <Button
              type="submit"
              variant="gold"
              disabled={!selectedProjectId}
              loading={assignMutation.isPending}
            >
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              <span>{ar.projects.assignSupervision}</span>
            </Button>
          </div>
        </form>
      </Card>

      <Modal
        open={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        title={ar.projects.overrideReason}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitAssignment(overrideReason.trim());
          }}
          className="space-y-4"
        >
          <div className="flex items-start gap-2 rounded-xl bg-[#fef3c7] p-3 text-sm font-bold text-[#b45309]">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{ar.projects.overrideRequiredNotice}</span>
          </div>
          <Field label={ar.projects.overrideReason} id="override-reason-input" required>
            <Input
              id="override-reason-input"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              required
              minLength={5}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOverrideModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={assignMutation.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
