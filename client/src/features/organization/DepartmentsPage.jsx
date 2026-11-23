import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ORG_STATUSES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
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
  useCreateDepartmentMutation,
  useDeactivateDepartmentMutation,
  useDepartmentsQuery,
  useUpdateDepartmentMutation,
} from './orgApi';

export default function DepartmentsPage() {
  const { collegeId } = useParams();
  const addToast = useUiStore((s) => s.addToast);
  const { data: res, isLoading, refetch } = useDepartmentsQuery(collegeId);
  const createDept = useCreateDepartmentMutation();
  const updateDept = useUpdateDepartmentMutation();
  const deactivateDept = useDeactivateDepartmentMutation();

  const [deptModal, setDeptModal] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [reason, setReason] = useState('');

  const departments = res?.data || [];

  async function saveDepartment(e) {
    e.preventDefault();
    try {
      if (deptModal._id) {
        await updateDept.mutateAsync({
          id: deptModal._id,
          name: deptModal.name,
          code: deptModal.code,
        });
      } else {
        await createDept.mutateAsync({ collegeId, name: deptModal.name, code: deptModal.code });
      }
      await refetch();
      setDeptModal(null);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function confirmDeactivate(e) {
    e.preventDefault();
    try {
      await deactivateDept.mutateAsync({ id: deactivateTarget._id, reason });
      await refetch();
      setDeactivateTarget(null);
      setReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const columns = [
    { key: 'name', header: ar.org.departmentName },
    {
      key: 'code',
      header: ar.org.departmentCode,
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDeptModal({ _id: row._id, name: row.name, code: row.code })}
          >
            {ar.common.edit}
          </Button>
          {row.status === ORG_STATUSES.ACTIVE && (
            <Button size="sm" variant="danger" onClick={() => setDeactivateTarget(row)}>
              {ar.org.deactivate}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.org.departments} — ${ar.common.platformName}`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link to="/app/organization" className="text-xs font-bold text-muted underline">
            {ar.common.back}
          </Link>
          <h1 className="text-2xl font-extrabold text-navy">{ar.org.departments}</h1>
        </div>
        <Button variant="gold" onClick={() => setDeptModal({ name: '', code: '' })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{ar.org.addDepartment}</span>
        </Button>
      </div>

      {isLoading ? <CardSkeleton /> : <ResponsiveTable columns={columns} rows={departments} />}

      <Modal
        open={Boolean(deptModal)}
        onClose={() => setDeptModal(null)}
        title={deptModal?._id ? ar.org.editDepartment : ar.org.addDepartment}
      >
        {deptModal && (
          <form onSubmit={saveDepartment} className="space-y-4">
            <Field label={ar.org.departmentName} id="dept-name" required>
              <Input
                id="dept-name"
                value={deptModal.name}
                onChange={(e) => setDeptModal((d) => ({ ...d, name: e.target.value }))}
              />
            </Field>
            <Field label={ar.org.departmentCode} id="dept-code" required>
              <Input
                id="dept-code"
                dir="ltr"
                value={deptModal.code}
                onChange={(e) => setDeptModal((d) => ({ ...d, code: e.target.value }))}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeptModal(null)}>
                {ar.common.cancel}
              </Button>
              <Button type="submit" variant="navy" loading={createDept.isPending || updateDept.isPending}>
                {ar.common.save}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title={ar.org.deactivate}
      >
        <form onSubmit={confirmDeactivate} className="space-y-4">
          <Field label={ar.org.deactivateReason} id="deact-dept-reason" required>
            <Input
              id="deact-dept-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="danger" loading={deactivateDept.isPending}>
              {ar.org.deactivate}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
