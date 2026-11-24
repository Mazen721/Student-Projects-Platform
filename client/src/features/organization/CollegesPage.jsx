import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Plus, Settings } from 'lucide-react';
import { ORG_STATUSES, ROLES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { useActiveRole } from '@/stores/authStore';
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
} from '@/components/ui';
import {
  useCollegesQuery,
  useCreateCollegeMutation,
  useDeactivateCollegeMutation,
  useUniversityQuery,
  useUpdateCollegeMutation,
  useUpdateCollegeSettingsMutation,
  useUpdateUniversityMutation,
} from './orgApi';

export default function CollegesPage() {
  const activeRole = useActiveRole();
  const isUniAdmin = activeRole === ROLES.UNIVERSITY_ADMIN;
  const addToast = useUiStore((s) => s.addToast);

  const { data: university } = useUniversityQuery(isUniAdmin);
  const updateUni = useUpdateUniversityMutation();
  const { data: collegesRes, isLoading } = useCollegesQuery({ limit: 100 });
  const createCollege = useCreateCollegeMutation();
  const updateCollege = useUpdateCollegeMutation();
  const updateSettings = useUpdateCollegeSettingsMutation();
  const deactivateCollege = useDeactivateCollegeMutation();

  const [uniModalOpen, setUniModalOpen] = useState(false);
  const [uniForm, setUniForm] = useState({ domains: '', minVoteHours: 24, burstLimit: 10 });
  const [collegeModal, setCollegeModal] = useState(null);
  const [settingsModal, setSettingsModal] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  const colleges = collegesRes?.data || [];

  function openUniSettings() {
    setUniForm({
      domains: (university?.settings?.allowedEmailDomains || []).join(', '),
      minVoteHours: university?.settings?.minVoteAccountAgeHours ?? 24,
      burstLimit: university?.settings?.voteBurstPerIp10m ?? 10,
    });
    setUniModalOpen(true);
  }

  async function saveUniSettings(e) {
    e.preventDefault();
    try {
      await updateUni.mutateAsync({
        allowedEmailDomains: uniForm.domains
          .split(/[،,]/)
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean),
        minVoteAccountAgeHours: Number(uniForm.minVoteHours),
        voteBurstPerIp10m: Number(uniForm.burstLimit),
      });
      setUniModalOpen(false);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function saveCollege(e) {
    e.preventDefault();
    try {
      if (collegeModal._id) {
        await updateCollege.mutateAsync({
          id: collegeModal._id,
          name: collegeModal.name,
          code: collegeModal.code,
        });
      } else {
        await createCollege.mutateAsync({ name: collegeModal.name, code: collegeModal.code });
      }
      setCollegeModal(null);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function saveCollegeSettings(e) {
    e.preventDefault();
    try {
      await updateSettings.mutateAsync({
        id: settingsModal.id,
        teamSizeMin: Number(settingsModal.teamSizeMin),
        teamSizeMax: Number(settingsModal.teamSizeMax),
        allowCrossCollege: Boolean(settingsModal.allowCrossCollege),
        supervisorPrimaryCap: Number(settingsModal.supervisorPrimaryCap),
        passMark: Number(settingsModal.passMark),
        gradeSpreadThreshold: Number(settingsModal.gradeSpreadThreshold),
        reevaluationWindowDays: Number(settingsModal.reevaluationWindowDays),
      });
      setSettingsModal(null);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function confirmDeactivate(e) {
    e.preventDefault();
    try {
      await deactivateCollege.mutateAsync({ id: deactivateTarget._id, reason: deactivateReason });
      setDeactivateTarget(null);
      setDeactivateReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const columns = [
    { key: 'name', header: ar.org.collegeName },
    {
      key: 'code',
      header: ar.org.collegeCode,
      render: (row) => (
        <span dir="ltr" className="inline-block font-bold [unicode-bidi:isolate]">
          {row.code}
        </span>
      ),
    },
    {
      key: 'status',
      header: ar.common.status,
      render: (row) => (
        <Badge tone={row.status === ORG_STATUSES.ACTIVE ? 'success' : 'danger'}>
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: ar.common.actions,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/app/organization/colleges/${row._id}/departments`}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-xs font-bold text-navy hover:bg-slate-50"
          >
            {ar.org.departments}
          </Link>
          <Link
            to={`/app/organization/colleges/${row._id}/academic-years`}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-xs font-bold text-navy hover:bg-slate-50"
          >
            {ar.org.academicYears}
          </Link>
          <Link
            to={`/app/organization/colleges/${row._id}/phase-templates`}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-xs font-bold text-navy hover:bg-slate-50"
          >
            {ar.tracking.phaseTemplates}
          </Link>
          <Link
            to={`/app/organization/colleges/${row._id}/rubrics`}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-xs font-bold text-navy hover:bg-slate-50"
          >
            {ar.evaluation.rubrics}
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setSettingsModal({
                id: row._id,
                ...row.settings,
              })
            }
          >
            {ar.org.collegeSettings}
          </Button>
          {isUniAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCollegeModal({ _id: row._id, name: row.name, code: row.code })}
              >
                {ar.common.edit}
              </Button>
              {row.status === ORG_STATUSES.ACTIVE && (
                <Button size="sm" variant="danger" onClick={() => setDeactivateTarget(row)}>
                  {ar.org.deactivate}
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.org.colleges} — ${ar.common.platformName}`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">{ar.nav.organization}</h1>
          <p className="text-sm text-muted">{ar.org.colleges}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isUniAdmin && (
            <Button variant="outline" onClick={openUniSettings}>
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span>{ar.org.universitySettings}</span>
            </Button>
          )}
          {isUniAdmin && (
            <Button variant="gold" onClick={() => setCollegeModal({ name: '', code: '' })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{ar.org.addCollege}</span>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? <CardSkeleton /> : <ResponsiveTable columns={columns} rows={colleges} />}

      <Modal
        open={Boolean(collegeModal)}
        onClose={() => setCollegeModal(null)}
        title={collegeModal?._id ? ar.org.editCollege : ar.org.addCollege}
      >
        {collegeModal && (
          <form onSubmit={saveCollege} className="space-y-4">
            <Field label={ar.org.collegeName} id="col-name" required>
              <Input
                id="col-name"
                value={collegeModal.name}
                onChange={(e) => setCollegeModal((c) => ({ ...c, name: e.target.value }))}
              />
            </Field>
            <Field label={ar.org.collegeCode} id="col-code" required>
              <Input
                id="col-code"
                dir="ltr"
                value={collegeModal.code}
                onChange={(e) => setCollegeModal((c) => ({ ...c, code: e.target.value }))}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCollegeModal(null)}>
                {ar.common.cancel}
              </Button>
              <Button type="submit" variant="navy" loading={createCollege.isPending || updateCollege.isPending}>
                {ar.common.save}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(settingsModal)}
        onClose={() => setSettingsModal(null)}
        title={ar.org.collegeSettings}
      >
        {settingsModal && (
          <form onSubmit={saveCollegeSettings} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={ar.org.teamSizeMin} id="set-tmin">
                <Input
                  id="set-tmin"
                  type="number"
                  value={settingsModal.teamSizeMin}
                  onChange={(e) => setSettingsModal((s) => ({ ...s, teamSizeMin: e.target.value }))}
                />
              </Field>
              <Field label={ar.org.teamSizeMax} id="set-tmax">
                <Input
                  id="set-tmax"
                  type="number"
                  value={settingsModal.teamSizeMax}
                  onChange={(e) => setSettingsModal((s) => ({ ...s, teamSizeMax: e.target.value }))}
                />
              </Field>
              <Field label={ar.org.supervisorPrimaryCap} id="set-cap">
                <Input
                  id="set-cap"
                  type="number"
                  value={settingsModal.supervisorPrimaryCap}
                  onChange={(e) => setSettingsModal((s) => ({ ...s, supervisorPrimaryCap: e.target.value }))}
                />
              </Field>
              <Field label={ar.org.passMark} id="set-pass">
                <Input
                  id="set-pass"
                  type="number"
                  value={settingsModal.passMark}
                  onChange={(e) => setSettingsModal((s) => ({ ...s, passMark: e.target.value }))}
                />
              </Field>
              <Field label={ar.org.gradeSpreadThreshold} id="set-spread">
                <Input
                  id="set-spread"
                  type="number"
                  value={settingsModal.gradeSpreadThreshold}
                  onChange={(e) => setSettingsModal((s) => ({ ...s, gradeSpreadThreshold: e.target.value }))}
                />
              </Field>
              <Field label={ar.org.reevaluationWindowDays} id="set-reeval">
                <Input
                  id="set-reeval"
                  type="number"
                  value={settingsModal.reevaluationWindowDays}
                  onChange={(e) => setSettingsModal((s) => ({ ...s, reevaluationWindowDays: e.target.value }))}
                />
              </Field>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={Boolean(settingsModal.allowCrossCollege)}
                onChange={(e) => setSettingsModal((s) => ({ ...s, allowCrossCollege: e.target.checked }))}
              />
              <span>{ar.org.allowCrossCollege}</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSettingsModal(null)}>
                {ar.common.cancel}
              </Button>
              <Button type="submit" variant="navy" loading={updateSettings.isPending}>
                {ar.common.save}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={uniModalOpen} onClose={() => setUniModalOpen(false)} title={ar.org.universitySettings}>
        <form onSubmit={saveUniSettings} className="space-y-4">
          <Field label={ar.org.allowedEmailDomains} id="uni-domains">
            <Input
              id="uni-domains"
              dir="ltr"
              value={uniForm.domains}
              onChange={(e) => setUniForm((u) => ({ ...u, domains: e.target.value }))}
            />
          </Field>
          <Field label={ar.org.minVoteAgeHours} id="uni-vote-age">
            <Input
              id="uni-vote-age"
              type="number"
              value={uniForm.minVoteHours}
              onChange={(e) => setUniForm((u) => ({ ...u, minVoteHours: e.target.value }))}
            />
          </Field>
          <Field label={ar.org.voteBurstLimit} id="uni-burst">
            <Input
              id="uni-burst"
              type="number"
              value={uniForm.burstLimit}
              onChange={(e) => setUniForm((u) => ({ ...u, burstLimit: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUniModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={updateUni.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title={ar.org.deactivate}
      >
        <form onSubmit={confirmDeactivate} className="space-y-4">
          <Card>{deactivateTarget?.name}</Card>
          <Field label={ar.org.deactivateReason} id="deact-col-reason" required>
            <Input
              id="deact-col-reason"
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="danger" loading={deactivateCollege.isPending}>
              {ar.org.deactivate}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
