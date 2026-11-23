import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Calendar } from 'lucide-react';
import { PROJECT_FIELD_VALUES, PROJECT_TYPE_VALUES } from '@spp/shared/constants';
import { isRegistrationOpen } from '@spp/shared/calc';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Button,
  Card,
  CardSkeleton,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { useDashboardHomeQuery } from '@/features/organization/orgApi';
import {
  useCreateProposalMutation,
  useProjectQuery,
  useSimilarTitlesQuery,
  useUpdateProposalMutation,
} from './projectsApi';

const EMPTY_FORM = {
  title: '',
  idea: '',
  problem: '',
  objectivesText: '',
  scope: '',
  field: PROJECT_FIELD_VALUES[0],
  type: PROJECT_TYPE_VALUES[0],
  beneficiaries: '',
  keywordsText: '',
  expectedOutcomes: '',
};

export default function ProposalFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const addToast = useUiStore((s) => s.addToast);
  const activeRoleId = useAuthStore((s) => s.activeRoleId);

  const { data: dashData } = useDashboardHomeQuery(activeRoleId);
  const { data: existingProject, isLoading } = useProjectQuery(id);
  const createProposal = useCreateProposalMutation();
  const updateProposal = useUpdateProposalMutation();

  const [form, setForm] = useState(EMPTY_FORM);
  const [debouncedTitle, setDebouncedTitle] = useState('');

  useEffect(() => {
    if (existingProject) {
      setForm({
        title: existingProject.title || '',
        idea: existingProject.idea || '',
        problem: existingProject.problem || '',
        objectivesText: (existingProject.objectives || []).join('\n'),
        scope: existingProject.scope || '',
        field: existingProject.field || PROJECT_FIELD_VALUES[0],
        type: existingProject.type || PROJECT_TYPE_VALUES[0],
        beneficiaries: existingProject.beneficiaries || '',
        keywordsText: (existingProject.keywords || []).join(', '),
        expectedOutcomes: existingProject.expectedOutcomes || '',
      });
      setDebouncedTitle(existingProject.title || '');
    }
  }, [existingProject]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTitle(form.title), 350);
    return () => clearTimeout(timer);
  }, [form.title]);

  const { data: similarTitles = [] } = useSimilarTitlesQuery(debouncedTitle, id);

  if (isEdit && isLoading) {
    return <CardSkeleton />;
  }

  const cycle = dashData?.summary?.currentAcademicYear?.cycle;
  const windowOpen = isRegistrationOpen(cycle);

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      title: form.title.trim(),
      idea: form.idea.trim(),
      problem: form.problem.trim(),
      objectives: form.objectivesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      scope: form.scope.trim(),
      field: form.field,
      type: form.type,
      beneficiaries: form.beneficiaries.trim(),
      keywords: form.keywordsText
        .split(/[،,]/)
        .map((k) => k.trim())
        .filter(Boolean),
      expectedOutcomes: form.expectedOutcomes.trim(),
    };

    try {
      if (isEdit) {
        await updateProposal.mutateAsync({ id, ...payload });
        addToast({ message: ar.org.savedSuccess, tone: 'success' });
        navigate(`/app/projects/${id}`);
      } else {
        const created = await createProposal.mutateAsync(payload);
        addToast({ message: ar.org.savedSuccess, tone: 'success' });
        navigate(`/app/projects/${created.id}`);
      }
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <Helmet
        title={`${isEdit ? ar.projects.editProposal : ar.projects.newProposal} — ${ar.common.platformName}`}
      />

      <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">
          {isEdit ? ar.projects.editProposal : ar.projects.newProposal}
        </h1>
      </header>

      {cycle && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold ${
            windowOpen
              ? 'border-[#dcfce7] bg-[#dcfce7] text-[#15803d]'
              : 'border-[#fee2e2] bg-[#fee2e2] text-[#b91c1c]'
          }`}
        >
          <Calendar className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>
            {windowOpen
              ? t('projects.windowOpenBanner', { date: formatDate(cycle.registrationClosesAt) })
              : ar.projects.windowClosedBanner}
          </span>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={ar.projects.title} id="proposal-title" required>
            <Input
              id="proposal-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </Field>

          {similarTitles.length > 0 && (
            <div
              role="alert"
              className="rounded-2xl border border-[#fef3c7] bg-[#fef3c7] p-4 text-sm text-[#b45309]"
            >
              <div className="flex items-center gap-2 font-extrabold">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{ar.projects.similarTitlesWarning}</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-xs font-semibold">
                {similarTitles.map((item) => (
                  <li key={item.id}>
                    {item.title} ({t('projects.similarityScore', { score: Math.round((item.score || 0) * 100) })})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={ar.projects.field} id="proposal-field" required>
              <Select
                id="proposal-field"
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

            <Field label={ar.projects.type} id="proposal-type" required>
              <Select
                id="proposal-type"
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

          <Field label={ar.projects.idea} id="proposal-idea" required>
            <Textarea
              id="proposal-idea"
              rows={3}
              value={form.idea}
              onChange={(e) => setForm((f) => ({ ...f, idea: e.target.value }))}
              required
            />
          </Field>

          <Field label={ar.projects.problem} id="proposal-problem" required>
            <Textarea
              id="proposal-problem"
              rows={3}
              value={form.problem}
              onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
              required
            />
          </Field>

          <Field label={ar.projects.objectives} id="proposal-objectives" required>
            <Textarea
              id="proposal-objectives"
              rows={3}
              value={form.objectivesText}
              onChange={(e) => setForm((f) => ({ ...f, objectivesText: e.target.value }))}
              required
            />
          </Field>

          <Field label={ar.projects.scope} id="proposal-scope" required>
            <Textarea
              id="proposal-scope"
              rows={2}
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={ar.projects.beneficiaries} id="proposal-beneficiaries" required>
              <Input
                id="proposal-beneficiaries"
                value={form.beneficiaries}
                onChange={(e) => setForm((f) => ({ ...f, beneficiaries: e.target.value }))}
                required
              />
            </Field>

            <Field label={ar.projects.keywords} id="proposal-keywords">
              <Input
                id="proposal-keywords"
                value={form.keywordsText}
                onChange={(e) => setForm((f) => ({ ...f, keywordsText: e.target.value }))}
              />
            </Field>
          </div>

          <Field label={ar.projects.expectedOutcomes} id="proposal-outcomes" required>
            <Textarea
              id="proposal-outcomes"
              rows={2}
              value={form.expectedOutcomes}
              onChange={(e) => setForm((f) => ({ ...f, expectedOutcomes: e.target.value }))}
              required
            />
          </Field>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate(isEdit ? `/app/projects/${id}` : '/app/projects')}
            >
              {ar.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="gold"
              loading={createProposal.isPending || updateProposal.isPending}
              disabled={!isEdit && Boolean(cycle) && !windowOpen}
            >
              {isEdit ? ar.common.save : ar.projects.saveDraft}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
