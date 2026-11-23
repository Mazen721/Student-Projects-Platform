import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { Edit3, Lock, Plus, Trash2 } from 'lucide-react';
import {
  RUBRIC_CRITERION_TARGETS,
  RUBRIC_STATUSES,
  WEIGHT_TOLERANCE,
} from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatNumber, formatPercent } from '@/lib/format';
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
} from '@/components/ui';
import { useAcademicYearsQuery } from '@/features/organization/orgApi';
import {
  useCreateRubricMutation,
  useRubricsQuery,
  useUpdateRubricMutation,
} from './evaluationApi';

function createCriterion(index) {
  return {
    key: `criterion_${index}_${Date.now()}`,
    name: '',
    weight: index === 1 ? 100 : 0,
    appliesTo: RUBRIC_CRITERION_TARGETS.TEAM,
  };
}

export default function RubricsPage() {
  const { collegeId } = useParams();
  const addToast = useUiStore((s) => s.addToast);

  const { data: yearsRes } = useAcademicYearsQuery(collegeId);
  const years = yearsRes?.data || [];
  const defaultYear = years.find((y) => y.isCurrent) || years[0];
  const [selectedYearId, setSelectedYearId] = useState('');
  const effectiveYearId = selectedYearId || defaultYear?.id || defaultYear?._id || '';

  const { data: rubrics = [], isLoading } = useRubricsQuery(collegeId, effectiveYearId);
  const createRubric = useCreateRubricMutation();
  const updateRubric = useUpdateRubricMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [supervisorPct, setSupervisorPct] = useState(40);
  const [committeePct, setCommitteePct] = useState(60);
  const [criteria, setCriteria] = useState([createCriterion(1)]);

  const splitTotal = Number(supervisorPct || 0) + Number(committeePct || 0);
  const splitValid = Math.abs(splitTotal - 100) <= WEIGHT_TOLERANCE;
  const criteriaTotal = criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
  const criteriaValid = Math.abs(criteriaTotal - 100) <= WEIGHT_TOLERANCE;

  function openNewModal() {
    setEditingId(null);
    setName('');
    setAcademicYearId(effectiveYearId);
    setSupervisorPct(40);
    setCommitteePct(60);
    setCriteria([createCriterion(1)]);
    setModalOpen(true);
  }

  function openEditModal(rubric) {
    setEditingId(rubric.id);
    setName(rubric.name);
    setAcademicYearId(rubric.academicYearId);
    setSupervisorPct(rubric.supervisorPct);
    setCommitteePct(rubric.committeePct);
    setCriteria(rubric.criteria || [createCriterion(1)]);
    setModalOpen(true);
  }

  function updateCriterion(index, patch) {
    setCriteria((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCriterionRow() {
    setCriteria((prev) => [...prev, createCriterion(prev.length + 1)]);
  }

  function removeCriterionRow(index) {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!splitValid) {
      addToast({ message: ar.validation.splitSum100, tone: 'error' });
      return;
    }
    if (!criteriaValid) {
      addToast({ message: ar.validation.weightsSum100, tone: 'error' });
      return;
    }
    const payload = {
      collegeId,
      academicYearId: academicYearId || effectiveYearId,
      name,
      supervisorPct: Number(supervisorPct),
      committeePct: Number(committeePct),
      criteria: criteria.map((c) => ({
        key: c.key,
        name: c.name,
        weight: Number(c.weight),
        appliesTo: c.appliesTo,
      })),
    };
    try {
      if (editingId) {
        await updateRubric.mutateAsync({
          id: editingId,
          collegeId,
          name,
          supervisorPct: Number(supervisorPct),
          committeePct: Number(committeePct),
          criteria: payload.criteria,
        });
      } else {
        await createRubric.mutateAsync(payload);
      }
      setModalOpen(false);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.evaluation.rubrics} — ${ar.common.platformName}`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">{ar.evaluation.rubrics}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {years.length > 0 && (
            <Select
              aria-label={ar.evaluation.academicYear}
              value={effectiveYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id || y._id} value={y.id || y._id}>
                  {y.label}
                </option>
              ))}
            </Select>
          )}
          <Button variant="gold" onClick={openNewModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{ar.evaluation.newRubric}</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : rubrics.length === 0 ? (
        <EmptyState
          title={ar.evaluation.rubrics}
          actionLabel={ar.evaluation.newRubric}
          onAction={openNewModal}
        />
      ) : (
        <div className="space-y-4">
          {rubrics.map((rubric) => {
            const isLocked = rubric.status === RUBRIC_STATUSES.LOCKED;
            return (
              <Card
                key={rubric.id}
                title={rubric.name}
                subtitle={t('evaluation.splitSummary', {
                  sup: formatNumber(rubric.supervisorPct),
                  comm: formatNumber(rubric.committeePct),
                })}
                actions={
                  <div className="flex items-center gap-2">
                    {isLocked ? (
                      <Badge tone="warning">
                        <Lock className="me-1 h-3 w-3" aria-hidden="true" />
                        <span>{ar.evaluation.rubricLockedBadge}</span>
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(rubric)}
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{ar.common.edit}</span>
                      </Button>
                    )}
                  </div>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(rubric.criteria || []).map((c) => (
                    <div
                      key={c.key}
                      className="flex items-center justify-between gap-2 rounded-xl border border-line bg-app-bg p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-navy">{c.name}</p>
                        <p className="text-xs text-muted">
                          {c.appliesTo === RUBRIC_CRITERION_TARGETS.INDIVIDUAL
                            ? ar.evaluation.targetIndividual
                            : ar.evaluation.targetTeam}
                        </p>
                      </div>
                      <Badge tone="info">{formatPercent(c.weight, { decimals: 0 })}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? ar.evaluation.editRubric : ar.evaluation.newRubric}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={ar.evaluation.rubricName} id="rubric-name" required>
            <Input
              id="rubric-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          {!editingId && years.length > 0 && (
            <Field label={ar.evaluation.academicYear} id="rubric-year" required>
              <Select
                id="rubric-year"
                value={academicYearId || effectiveYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
              >
                {years.map((y) => (
                  <option key={y.id || y._id} value={y.id || y._id}>
                    {y.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={ar.evaluation.supervisorPct} id="rubric-sup" required>
              <Input
                id="rubric-sup"
                type="number"
                min="0"
                max="100"
                value={supervisorPct}
                onChange={(e) => setSupervisorPct(e.target.value)}
                required
              />
            </Field>
            <Field label={ar.evaluation.committeePct} id="rubric-comm" required>
              <Input
                id="rubric-comm"
                type="number"
                min="0"
                max="100"
                value={committeePct}
                onChange={(e) => setCommitteePct(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone={splitValid ? 'success' : 'danger'}>
                {t('evaluation.splitSummary', {
                  sup: formatNumber(supervisorPct),
                  comm: formatNumber(committeePct),
                })}
              </Badge>
              <Badge tone={criteriaValid ? 'success' : 'danger'}>
                {t('evaluation.criteriaTotal', { total: formatNumber(criteriaTotal) })}
              </Badge>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addCriterionRow}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{ar.evaluation.addCriterion}</span>
            </Button>
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto pe-1">
            {criteria.map((c, idx) => (
              <div key={c.key} className="rounded-xl border border-line p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-navy">
                    {ar.evaluation.criterionName} ({formatNumber(idx + 1)})
                  </span>
                  {criteria.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={ar.common.delete}
                      onClick={() => removeCriterionRow(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-[#b91c1c]" aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label={ar.evaluation.criterionName} id={`crit-name-${idx}`} required>
                    <Input
                      id={`crit-name-${idx}`}
                      value={c.name}
                      onChange={(e) => updateCriterion(idx, { name: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={ar.evaluation.criterionWeight} id={`crit-w-${idx}`} required>
                    <Input
                      id={`crit-w-${idx}`}
                      type="number"
                      min="1"
                      max="100"
                      value={c.weight}
                      onChange={(e) => updateCriterion(idx, { weight: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={ar.evaluation.criterionTarget} id={`crit-t-${idx}`}>
                    <Select
                      id={`crit-t-${idx}`}
                      value={c.appliesTo}
                      onChange={(e) => updateCriterion(idx, { appliesTo: e.target.value })}
                    >
                      <option value={RUBRIC_CRITERION_TARGETS.TEAM}>
                        {ar.evaluation.targetTeam}
                      </option>
                      <option value={RUBRIC_CRITERION_TARGETS.INDIVIDUAL}>
                        {ar.evaluation.targetIndividual}
                      </option>
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="navy"
              loading={createRubric.isPending || updateRubric.isPending}
            >
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
