import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Copy, Link2 } from 'lucide-react';
import { ROLES, SCOPE_TYPES, USER_STATUSES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
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
  Pagination,
  ResponsiveTable,
  Select,
  Tabs,
} from '@/components/ui';
import {
  useAssignRoleMutation,
  useCollegesQuery,
  useCreateInvitationMutation,
  useDeactivateUserMutation,
  useDepartmentsQuery,
  usePendingInvestorsQuery,
  useReactivateUserMutation,
  useResetPasswordMutation,
  useReviewInvestorMutation,
  useUsersQuery,
} from './orgApi';

export default function UsersAdminPage() {
  const roles = useAuthStore((s) => s.roles);
  const isUniAdmin = roles.some((r) => r.role === ROLES.UNIVERSITY_ADMIN);
  const addToast = useUiStore((s) => s.addToast);

  const [tab, setTab] = useState('users');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data: usersRes, isLoading } = useUsersQuery({ q: search || undefined, page, limit: 20 });
  const { data: pendingRes } = usePendingInvestorsQuery(isUniAdmin && tab === 'investors');
  const { data: collegesRes } = useCollegesQuery({ limit: 100 });

  const resetPassword = useResetPasswordMutation();
  const deactivateUser = useDeactivateUserMutation();
  const reactivateUser = useReactivateUserMutation();
  const assignRole = useAssignRoleMutation();
  const createInvite = useCreateInvitationMutation();
  const reviewInvestor = useReviewInvestorMutation();

  const [tempPassword, setTempPassword] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [releaseIdentifiers, setReleaseIdentifiers] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    role: ROLES.SUPERVISOR,
    scopeType: SCOPE_TYPES.COLLEGE,
    collegeId: '',
    scopeId: '',
  });
  const [generatedInvite, setGeneratedInvite] = useState(null);

  const [assignTarget, setAssignTarget] = useState(null);
  const [assignForm, setAssignForm] = useState({
    role: ROLES.SUPERVISOR,
    scopeType: SCOPE_TYPES.COLLEGE,
    collegeId: '',
    scopeId: '',
  });

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: inviteDeptsRes } = useDepartmentsQuery(inviteForm.collegeId);
  const { data: assignDeptsRes } = useDepartmentsQuery(assignForm.collegeId);
  const colleges = collegesRes?.data || [];

  async function handleResetPassword(userId) {
    try {
      const data = await resetPassword.mutateAsync(userId);
      setTempPassword(data.temporaryPassword);
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleDeactivate(e) {
    e.preventDefault();
    try {
      await deactivateUser.mutateAsync({
        id: deactivateTarget.id,
        reason: deactivateReason,
        releaseIdentifiers,
      });
      setDeactivateTarget(null);
      setDeactivateReason('');
      setReleaseIdentifiers(false);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleReactivate(userId) {
    try {
      await reactivateUser.mutateAsync(userId);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleCreateInvite(e) {
    e.preventDefault();
    try {
      const scopeId =
        inviteForm.scopeType === SCOPE_TYPES.UNIVERSITY
          ? undefined
          : inviteForm.scopeType === SCOPE_TYPES.COLLEGE
            ? inviteForm.collegeId
            : inviteForm.scopeId;
      const data = await createInvite.mutateAsync({
        role: inviteForm.role,
        scopeType: inviteForm.scopeType,
        ...(scopeId ? { scopeId } : {}),
      });
      setGeneratedInvite(data);
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleAssignRole(e) {
    e.preventDefault();
    try {
      const scopeId =
        assignForm.scopeType === SCOPE_TYPES.UNIVERSITY
          ? undefined
          : assignForm.scopeType === SCOPE_TYPES.COLLEGE
            ? assignForm.collegeId
            : assignForm.scopeId;
      await assignRole.mutateAsync({
        userId: assignTarget.id,
        role: assignForm.role,
        scopeType: assignForm.scopeType,
        ...(scopeId ? { scopeId } : {}),
      });
      setAssignTarget(null);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function copyText(text, successMsg) {
    await navigator.clipboard?.writeText(text);
    addToast({ message: successMsg, tone: 'success' });
  }

  const users = usersRes?.data || [];
  const pageMeta = usersRes?.page;
  const pendingInvestors = pendingRes?.data || [];
  const generatedInviteUrl = generatedInvite
    ? `${window.location.origin}${generatedInvite.url}`
    : '';

  const userColumns = [
    { key: 'name', header: ar.auth.name },
    {
      key: 'email',
      header: ar.auth.email,
      render: (row) => (
        <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
          {row.email}
        </span>
      ),
    },
    {
      key: 'roles',
      header: ar.nav.roleContext,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.roles || []).map((r) => (
            <Badge key={r._id || r.role} tone="info">
              {t(`roles.${r.role}`)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: ar.common.status,
      render: (row) => (
        <Badge tone={row.status === USER_STATUSES.ACTIVE ? 'success' : 'danger'}>
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: ar.common.actions,
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => handleResetPassword(row.id)}>
            {ar.org.resetPassword}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAssignTarget(row)}>
            {ar.org.assignRole}
          </Button>
          {row.status === USER_STATUSES.ACTIVE ? (
            <Button size="sm" variant="danger" onClick={() => setDeactivateTarget(row)}>
              {ar.org.deactivate}
            </Button>
          ) : (
            <Button size="sm" variant="navy" onClick={() => handleReactivate(row.id)}>
              {ar.org.reactivate}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const investorColumns = [
    { key: 'name', header: ar.auth.name },
    { key: 'org', header: ar.auth.organization, render: (r) => r.investor?.organization || '—' },
    { key: 'field', header: ar.auth.fieldOfInterest, render: (r) => r.investor?.fieldOfInterest || '—' },
    {
      key: 'actions',
      header: ar.common.actions,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="gold"
            onClick={() => reviewInvestor.mutate({ id: row.id, decision: 'approve' })}
          >
            {ar.org.approveInvestor}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setRejectTarget(row)}>
            {ar.org.rejectInvestor}
          </Button>
        </div>
      ),
    },
  ];

  const roleOptions = [
    ROLES.SUPERVISOR,
    ROLES.DEPARTMENT_ADMIN,
    ROLES.COLLEGE_ADMIN,
    ROLES.UNIVERSITY_ADMIN,
  ].map((r) => ({ value: r, label: t(`roles.${r}`) }));

  const scopeTypeOptions = [
    { value: SCOPE_TYPES.COLLEGE, label: ar.auth.college },
    { value: SCOPE_TYPES.DEPARTMENT, label: ar.auth.department },
    ...(isUniAdmin ? [{ value: SCOPE_TYPES.UNIVERSITY, label: ar.org.university }] : []),
  ];

  const tabs = [
    { value: 'users', label: ar.nav.users },
    ...(isUniAdmin ? [{ value: 'investors', label: ar.org.pendingInvestors }] : []),
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.org.usersTitle} — ${ar.common.platformName}`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">{ar.org.usersTitle}</h1>
        <Button
          variant="gold"
          onClick={() => {
            setGeneratedInvite(null);
            setInviteOpen(true);
          }}
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
          <span>{ar.org.createInvite}</span>
        </Button>
      </div>

      {tabs.length > 1 && <Tabs items={tabs} value={tab} onChange={setTab} />}

      {tab === 'users' && (
        <div className="space-y-4">
          <Input
            placeholder={ar.org.searchUsersPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {isLoading ? (
            <CardSkeleton />
          ) : (
            <>
              <ResponsiveTable columns={userColumns} rows={users} />
              <Pagination
                page={pageMeta?.page || 1}
                pages={pageMeta?.pages || 0}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}

      {tab === 'investors' && isUniAdmin && (
        <ResponsiveTable columns={investorColumns} rows={pendingInvestors} />
      )}

      <Modal open={Boolean(tempPassword)} onClose={() => setTempPassword('')} title={ar.org.resetPassword}>
        <div className="space-y-4">
          <p className="text-sm text-ink">{ar.org.tempPasswordOnceNotice}</p>
          <div className="flex items-center justify-between rounded-xl border border-line bg-app-bg p-3">
            <code dir="ltr" className="text-base font-extrabold text-navy [unicode-bidi:isolate]">
              {tempPassword}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyText(tempPassword, ar.org.savedSuccess)}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title={ar.org.deactivate}
      >
        <form onSubmit={handleDeactivate} className="space-y-4">
          <Card>{deactivateTarget?.name}</Card>
          <Field label={ar.org.deactivateReason} id="deact-user-reason" required>
            <Input
              id="deact-user-reason"
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
            />
          </Field>
          {deactivateTarget?.accountType === 'student' && (
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={releaseIdentifiers}
                onChange={(e) => setReleaseIdentifiers(e.target.checked)}
              />
              <span>{ar.org.releaseIdentifiersLabel}</span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="danger" loading={deactivateUser.isPending}>
              {ar.org.deactivate}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={ar.org.inviteLinkTitle}>
        <form onSubmit={handleCreateInvite} className="space-y-4">
          <Field label={ar.org.inviteRole} id="inv-role">
            <Select
              id="inv-role"
              placeholder={false}
              options={roleOptions}
              value={inviteForm.role}
              onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
            />
          </Field>
          <Field label={ar.org.inviteScopeType} id="inv-scope-type">
            <Select
              id="inv-scope-type"
              placeholder={false}
              options={scopeTypeOptions}
              value={inviteForm.scopeType}
              onChange={(e) => setInviteForm((f) => ({ ...f, scopeType: e.target.value, scopeId: '' }))}
            />
          </Field>
          {inviteForm.scopeType !== SCOPE_TYPES.UNIVERSITY && (
            <Field label={ar.auth.college} id="inv-college">
              <Select
                id="inv-college"
                options={colleges.map((c) => ({ value: c._id, label: c.name }))}
                value={inviteForm.collegeId}
                onChange={(e) => setInviteForm((f) => ({ ...f, collegeId: e.target.value, scopeId: '' }))}
              />
            </Field>
          )}
          {inviteForm.scopeType === SCOPE_TYPES.DEPARTMENT && (
            <Field label={ar.auth.department} id="inv-dept">
              <Select
                id="inv-dept"
                options={(inviteDeptsRes?.data || []).map((d) => ({ value: d._id, label: d.name }))}
                value={inviteForm.scopeId}
                onChange={(e) => setInviteForm((f) => ({ ...f, scopeId: e.target.value }))}
              />
            </Field>
          )}
          {generatedInvite && (
            <div className="rounded-xl border border-line bg-app-bg p-3 space-y-2">
              <p dir="ltr" className="break-all text-xs font-bold text-navy [unicode-bidi:isolate]">
                {generatedInviteUrl}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyText(generatedInviteUrl, ar.org.inviteCopied)}
              >
                {ar.org.copyInviteUrl}
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {ar.common.close}
            </Button>
            <Button type="submit" variant="navy" loading={createInvite.isPending}>
              {ar.org.createInvite}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title={ar.org.assignRole}
      >
        <form onSubmit={handleAssignRole} className="space-y-4">
          <Field label={ar.org.inviteRole} id="asg-role">
            <Select
              id="asg-role"
              placeholder={false}
              options={roleOptions}
              value={assignForm.role}
              onChange={(e) => setAssignForm((f) => ({ ...f, role: e.target.value }))}
            />
          </Field>
          <Field label={ar.org.inviteScopeType} id="asg-scope">
            <Select
              id="asg-scope"
              placeholder={false}
              options={scopeTypeOptions}
              value={assignForm.scopeType}
              onChange={(e) => setAssignForm((f) => ({ ...f, scopeType: e.target.value, scopeId: '' }))}
            />
          </Field>
          {assignForm.scopeType !== SCOPE_TYPES.UNIVERSITY && (
            <Field label={ar.auth.college} id="asg-col">
              <Select
                id="asg-col"
                options={colleges.map((c) => ({ value: c._id, label: c.name }))}
                value={assignForm.collegeId}
                onChange={(e) => setAssignForm((f) => ({ ...f, collegeId: e.target.value, scopeId: '' }))}
              />
            </Field>
          )}
          {assignForm.scopeType === SCOPE_TYPES.DEPARTMENT && (
            <Field label={ar.auth.department} id="asg-dept">
              <Select
                id="asg-dept"
                options={(assignDeptsRes?.data || []).map((d) => ({ value: d._id, label: d.name }))}
                value={assignForm.scopeId}
                onChange={(e) => setAssignForm((f) => ({ ...f, scopeId: e.target.value }))}
              />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={assignRole.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={ar.org.rejectInvestor}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await reviewInvestor.mutateAsync({
              id: rejectTarget.id,
              decision: 'reject',
              reason: rejectReason,
            });
            setRejectTarget(null);
            setRejectReason('');
          }}
          className="space-y-4"
        >
          <Field label={ar.org.rejectionReason} id="rej-reason">
            <Input
              id="rej-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="danger" loading={reviewInvestor.isPending}>
              {ar.org.rejectInvestor}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
