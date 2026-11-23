import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Megaphone, Plus } from 'lucide-react';
import { ROLES, SCOPE_TYPES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatNumber } from '@/lib/format';
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
  Pagination,
  Select,
  Textarea,
} from '@/components/ui';
import { useCollegesQuery, useDepartmentsQuery } from '@/features/organization/orgApi';
import {
  useAnnouncementsQuery,
  useCreateAnnouncementMutation,
} from './collaborationApi';

const PUBLISH_ROLES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
  ROLES.SUPERVISOR,
]);

export default function AnnouncementsPage() {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const { data, isLoading } = useAnnouncementsQuery({ page });
  const createMutation = useCreateAnnouncementMutation();

  const canPublish = roles.some((r) => PUBLISH_ROLES.has(r.role));
  const isUniAdmin = roles.some((r) => r.role === ROLES.UNIVERSITY_ADMIN);
  const isCollegeAdmin = roles.some((r) => r.role === ROLES.COLLEGE_ADMIN);
  const isDeptAdmin = roles.some((r) => r.role === ROLES.DEPARTMENT_ADMIN);
  const isSupervisor = roles.some((r) => r.role === ROLES.SUPERVISOR);

  const defaultScope = isUniAdmin
    ? SCOPE_TYPES.UNIVERSITY
    : isCollegeAdmin
      ? SCOPE_TYPES.COLLEGE
      : isDeptAdmin
        ? SCOPE_TYPES.DEPARTMENT
        : 'supervision';

  const [modalOpen, setModalOpen] = useState(false);
  const [scopeType, setScopeType] = useState(defaultScope);
  const [collegeId, setCollegeId] = useState(user?.collegeId || '');
  const [departmentId, setDepartmentId] = useState(user?.departmentId || '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data: collegesRes } = useCollegesQuery({ limit: 100 });
  const { data: departmentsRes } = useDepartmentsQuery(collegeId);
  const colleges = collegesRes?.data || [];
  const departments = departmentsRes || [];

  async function handlePublish(e) {
    e.preventDefault();
    const scopeId =
      scopeType === SCOPE_TYPES.COLLEGE
        ? collegeId
        : scopeType === SCOPE_TYPES.DEPARTMENT
          ? departmentId
          : undefined;

    try {
      const created = await createMutation.mutateAsync({
        scopeType,
        ...(scopeId ? { scopeId } : {}),
        title: title.trim(),
        body: body.trim(),
      });
      setModalOpen(false);
      setTitle('');
      setBody('');
      addToast({
        message: t('chat.audienceCountLabel', { count: formatNumber(created.audienceCount) }),
        tone: 'success',
      });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const items = data?.data || [];
  const pageMeta = data?.page;

  const scopeOptions = [
    ...(isUniAdmin ? [{ value: SCOPE_TYPES.UNIVERSITY, label: ar.chat.scopeUniversity }] : []),
    ...(isUniAdmin || isCollegeAdmin
      ? [{ value: SCOPE_TYPES.COLLEGE, label: ar.chat.scopeCollege }]
      : []),
    ...(isUniAdmin || isCollegeAdmin || isDeptAdmin
      ? [{ value: SCOPE_TYPES.DEPARTMENT, label: ar.chat.scopeDepartment }]
      : []),
    ...(isSupervisor || isUniAdmin || isCollegeAdmin || isDeptAdmin
      ? [{ value: 'supervision', label: ar.chat.scopeSupervision }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.chat.announcements} — ${ar.common.platformName}`} />

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white">
        <div>
          <h1 className="text-2xl font-extrabold">{ar.chat.announcements}</h1>
        </div>
        {canPublish && (
          <Button variant="gold" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{ar.chat.newAnnouncement}</span>
          </Button>
        )}
      </header>

      {isLoading ? (
        <CardSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={Megaphone} title={ar.chat.noAnnouncementsYet} />
      ) : (
        <div className="space-y-3">
          {items.map((ann) => (
            <Card key={ann.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-navy">{ann.title}</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {ann.authorName} · {formatDateTime(ann.createdAt)}
                  </p>
                </div>
                <Badge tone="info">
                  {t('chat.audienceCountLabel', { count: formatNumber(ann.audienceCount) })}
                </Badge>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-ink">{ann.body}</p>
            </Card>
          ))}
          {pageMeta && pageMeta.pages > 1 && (
            <Pagination page={pageMeta.page} pages={pageMeta.pages} onPageChange={setPage} />
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={ar.chat.newAnnouncement}
      >
        <form onSubmit={handlePublish} className="space-y-4">
          <Field label={ar.chat.announcementScope} required>
            <Select value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
              {scopeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          {(scopeType === SCOPE_TYPES.COLLEGE || scopeType === SCOPE_TYPES.DEPARTMENT) && (
            <Field label={ar.auth.college} required>
              <Select value={collegeId} onChange={(e) => setCollegeId(e.target.value)}>
                <option value="">{ar.common.selectPlaceholder}</option>
                {colleges.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {scopeType === SCOPE_TYPES.DEPARTMENT && (
            <Field label={ar.auth.department} required>
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">{ar.common.selectPlaceholder}</option>
                {departments.map((d) => (
                  <option key={d.id || d._id} value={d.id || d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label={ar.chat.announcementTitle} required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>

          <Field label={ar.chat.announcementBody} required>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={createMutation.isPending}>
              {ar.chat.send}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
