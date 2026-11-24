import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Plus, Trash2 } from 'lucide-react';
import { PROJECT_FIELD_VALUES, PROJECT_TYPE_VALUES, ROLES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { useActiveRole } from '@/stores/authStore';
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
  Select,
  Textarea,
} from '@/components/ui';
import {
  useCreateIdeaMutation,
  useDecideAdoptionMutation,
  useIdeasQuery,
  useMyAdoptionRequestsQuery,
  useRemoveIdeaMutation,
  useRequestAdoptionMutation,
} from './projectsApi';

export default function IdeasBankPage() {
  const navigate = useNavigate();
  const activeRole = useActiveRole();
  const addToast = useUiStore((s) => s.addToast);

  const canCreateIdea = [ROLES.SUPERVISOR, ROLES.INVESTOR].includes(activeRole);
  const isStudent = activeRole === ROLES.STUDENT;
  const isAdmin = [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(
    activeRole
  );

  const [fieldFilter, setFieldFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    field: PROJECT_FIELD_VALUES[0],
    type: PROJECT_TYPE_VALUES[0],
  });

  const { data: ideasRes, isLoading } = useIdeasQuery(
    fieldFilter ? { field: fieldFilter } : {}
  );
  const { data: requests = [] } = useMyAdoptionRequestsQuery(canCreateIdea);
  const createIdea = useCreateIdeaMutation();
  const removeIdea = useRemoveIdeaMutation();
  const requestAdoption = useRequestAdoptionMutation();
  const decideAdoption = useDecideAdoptionMutation();

  if (isLoading) {
    return <CardSkeleton />;
  }

  const ideas = ideasRes?.data || [];

  async function handleCreateIdea(e) {
    e.preventDefault();
    try {
      await createIdea.mutateAsync(form);
      setCreateOpen(false);
      setForm({
        title: '',
        description: '',
        field: PROJECT_FIELD_VALUES[0],
        type: PROJECT_TYPE_VALUES[0],
      });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleRequestAdoption(ideaId) {
    try {
      await requestAdoption.mutateAsync({ id: ideaId });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleDecideAdoption(id, decision) {
    try {
      const outcome = await decideAdoption.mutateAsync({ id, decision });
      if (decision === 'accept' && outcome?.project?.id) {
        addToast({ message: ar.projects.adoptionAcceptedNotice, tone: 'success' });
        navigate(`/app/projects/${outcome.project.id}`);
      } else {
        addToast({ message: ar.org.savedSuccess, tone: 'success' });
      }
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleRemoveIdea(id) {
    try {
      await removeIdea.mutateAsync({ id, reason: ar.projects.removeIdea });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.projects.ideasTitle} — ${ar.common.platformName}`} />

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.projects.ideasTitle}</h1>
        {canCreateIdea && (
          <Button variant="gold" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{ar.projects.addIdea}</span>
          </Button>
        )}
      </header>

      {canCreateIdea && requests.length > 0 && (
        <Card title={ar.projects.adoptionRequests}>
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-app-bg p-3 text-sm"
              >
                <div>
                  <p className="font-extrabold text-navy">{req.ideaTitle}</p>
                  <p className="text-xs text-muted">{req.requesterName}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDecideAdoption(req.id, 'decline')}
                    loading={decideAdoption.isPending}
                  >
                    {ar.projects.declineAdoption}
                  </Button>
                  <Button
                    variant="gold"
                    onClick={() => handleDecideAdoption(req.id, 'accept')}
                    loading={decideAdoption.isPending}
                  >
                    {ar.projects.acceptAdoption}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="max-w-xs">
          <Field label={ar.projects.field} id="ideas-field-filter">
            <Select
              id="ideas-field-filter"
              placeholder={ar.common.all}
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
            >
              {PROJECT_FIELD_VALUES.map((val) => (
                <option key={val} value={val}>
                  {t(`projects.fields.${val}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {ideas.length === 0 ? (
        <EmptyState icon={Lightbulb} title={ar.common.noData} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ideas.map((idea) => (
            <Card key={idea.id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-extrabold text-navy">{idea.title}</h2>
                  <Badge tone="info">{t(`projects.fields.${idea.field}`)}</Badge>
                </div>
                <p className="text-sm text-ink">{idea.description}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted">
                  <span>
                    {ar.projects.ideaOwner}: <strong className="text-ink">{idea.ownerName}</strong>
                  </span>
                  <div className="flex gap-2">
                    {isStudent && (
                      <Button
                        variant="gold"
                        onClick={() => handleRequestAdoption(idea.id)}
                        loading={requestAdoption.isPending}
                      >
                        {ar.projects.requestAdoption}
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        onClick={() => handleRemoveIdea(idea.id)}
                        loading={removeIdea.isPending}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span>{ar.projects.removeIdea}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={ar.projects.addIdea}>
        <form onSubmit={handleCreateIdea} className="space-y-4">
          <Field label={ar.projects.ideaTitle} id="idea-title" required>
            <Input
              id="idea-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={ar.projects.field} id="idea-field" required>
              <Select
                id="idea-field"
                value={form.field}
                onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))}
              >
                {PROJECT_FIELD_VALUES.map((val) => (
                  <option key={val} value={val}>
                    {t(`projects.fields.${val}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={ar.projects.type} id="idea-type" required>
              <Select
                id="idea-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {PROJECT_TYPE_VALUES.map((val) => (
                  <option key={val} value={val}>
                    {t(`projects.types.${val}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={ar.projects.ideaDescription} id="idea-desc" required>
            <Textarea
              id="idea-desc"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={createIdea.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
