import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Lock, Unlock } from 'lucide-react';
import {
  DEFENSE_STATES,
  MODIFICATION_STATES,
  ROLES,
  RUBRIC_CRITERION_TARGETS,
} from '@spp/shared/constants';
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
  Field,
  Input,
  ResponsiveTable,
  Textarea,
} from '@/components/ui';
import {
  useAllDefenseScoresQuery,
  useConfirmModificationsMutation,
  useDefenseQuery,
  useMyScoresheetQuery,
  useRecordMinutesMutation,
  useSubmitMyScoresMutation,
  useTransitionDefenseMutation,
} from './evaluationApi';

const ADMIN_ROLES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

export default function GradingWorkspacePage() {
  const { id: defenseId } = useParams();
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const { data: defense, isLoading } = useDefenseQuery(defenseId);
  const isChair = String(defense?.chairId || '') === String(user?.id || '');
  const isSupervisor = String(defense?.supervisorId || '') === String(user?.id || '');
  const isExaminer = (defense?.examinerIds || []).includes(String(user?.id || ''));
  const isAdmin = roles.some((r) => ADMIN_ROLES.has(r.role));

  const canScore = Boolean(defense && (isSupervisor || isExaminer));
  const { data: scoresheet } = useMyScoresheetQuery(canScore ? defenseId : null);
  const canViewAll = Boolean(
    defense &&
      (isChair || isExaminer || isAdmin) &&
      defense.submittedCount >= defense.totalExaminers &&
      defense.totalExaminers > 0
  );
  const { data: allScores } = useAllDefenseScoresQuery(defenseId, canViewAll);

  const submitScores = useSubmitMyScoresMutation();
  const transitionDefense = useTransitionDefenseMutation();
  const recordMinutes = useRecordMinutesMutation();
  const confirmModifications = useConfirmModificationsMutation();

  const [teamScores, setTeamScores] = useState({});
  const [individualScores, setIndividualScores] = useState({});
  const [finalizeNote, setFinalizeNote] = useState('');
  const [minutes, setMinutes] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [modRequired, setModRequired] = useState(false);
  const [modDescription, setModDescription] = useState('');
  const [modDeadline, setModDeadline] = useState('');

  useEffect(() => {
    if (scoresheet?.myScore) {
      setTeamScores(scoresheet.myScore.teamScores || {});
      setIndividualScores(scoresheet.myScore.individualScores || {});
    }
  }, [scoresheet]);

  useEffect(() => {
    if (defense) {
      setMinutes(defense.minutes || '');
      setRecommendations(defense.recommendations || '');
      setModRequired(Boolean(defense.modifications?.required));
      setModDescription(defense.modifications?.description || '');
      setModDeadline(
        defense.modifications?.deadline
          ? new Date(defense.modifications.deadline).toISOString().slice(0, 10)
          : ''
      );
    }
  }, [defense]);

  if (isLoading || !defense) {
    return <CardSkeleton />;
  }

  const isScoringState = [
    DEFENSE_STATES.GRADING,
    DEFENSE_STATES.DELIBERATION,
    DEFENSE_STATES.REEVALUATION_OPEN,
  ].includes(defense.state);
  const alreadySubmitted = Boolean(scoresheet?.myScore?.submittedAt);
  const teamCriteriaLocked = scoresheet?.activeReevaluation?.scope === 'student';

  async function handleSaveScores(submit) {
    try {
      await submitScores.mutateAsync({
        defenseId,
        teamScores,
        individualScores,
        submit,
      });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleTransition(event) {
    try {
      await transitionDefense.mutateAsync({
        defenseId,
        event,
        note: finalizeNote.trim() || undefined,
      });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleSaveMinutes(e) {
    e.preventDefault();
    try {
      await recordMinutes.mutateAsync({
        defenseId,
        minutes,
        ...(recommendations.trim() ? { recommendations: recommendations.trim() } : {}),
        modifications: {
          required: modRequired,
          ...(modDescription.trim() ? { description: modDescription.trim() } : {}),
          ...(modDeadline ? { deadline: new Date(modDeadline).toISOString() } : {}),
        },
      });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleConfirmMods() {
    try {
      await confirmModifications.mutateAsync(defenseId);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const teamCriteria = (scoresheet?.rubric?.criteria || []).filter(
    (c) => c.appliesTo === RUBRIC_CRITERION_TARGETS.TEAM
  );
  const indivCriteria = (scoresheet?.rubric?.criteria || []).filter(
    (c) => c.appliesTo === RUBRIC_CRITERION_TARGETS.INDIVIDUAL
  );

  const scoresColumns = allScores
    ? [
        { key: 'name', header: ar.auth.name },
        {
          key: 'component',
          header: ar.common.status,
          render: (r) =>
            r.component === 'supervisor' ? ar.projects.primarySupervisor : ar.evaluation.committee,
        },
        ...(allScores.students || []).map((st) => ({
          key: `stu_${st.id}`,
          header: st.name,
          render: (r) => formatNumber(r.totals?.[st.id] ?? 0),
        })),
      ]
    : [];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.evaluation.scoresheet} — ${ar.common.platformName}`} />

      <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold">{defense.projectTitle}</h1>
              <Badge tone="featured">{t(`statuses.${defense.state}`)}</Badge>
            </div>
            <p className="text-sm text-gold-light">
              {formatDateTime(defense.scheduledAt)} ·{' '}
              {t('evaluation.submittedProgress', {
                submitted: formatNumber(defense.submittedCount),
                total: formatNumber(defense.totalExaminers),
              })}
            </p>
          </div>
          {(isChair || isAdmin) && defense.state === DEFENSE_STATES.SCHEDULED && (
            <Button
              variant="gold"
              onClick={() => handleTransition('OPEN_GRADING')}
              loading={transitionDefense.isPending}
            >
              {ar.evaluation.openGrading}
            </Button>
          )}
        </div>
      </header>

      {canScore && isScoringState && scoresheet && (
        <Card
          title={ar.evaluation.scoresheet}
          subtitle={ar.evaluation.blindGradingHint}
          actions={
            alreadySubmitted ? (
              <Badge tone="success">{ar.evaluation.scoresSubmittedBadge}</Badge>
            ) : null
          }
        >
          <div className="space-y-6">
            {teamCriteria.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-navy">
                  {ar.evaluation.teamCriteriaSection}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {teamCriteria.map((c) => (
                    <Field key={c.key} label={`${c.name} (${formatNumber(c.weight)}%)`} id={`t-${c.key}`}>
                      <Input
                        id={`t-${c.key}`}
                        type="number"
                        min="0"
                        max="100"
                        disabled={alreadySubmitted || teamCriteriaLocked}
                        value={teamScores[c.key] ?? ''}
                        onChange={(e) =>
                          setTeamScores((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))
                        }
                      />
                    </Field>
                  ))}
                </div>
              </div>
            )}

            {indivCriteria.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-extrabold text-navy">
                  {ar.evaluation.individualCriteriaSection}
                </h2>
                {(scoresheet.students || []).map((stu) => {
                  const lockedOtherStudent =
                    teamCriteriaLocked &&
                    String(scoresheet.activeReevaluation?.studentId) !== String(stu.id);
                  return (
                    <div key={stu.id} className="rounded-xl border border-line bg-app-bg p-4 space-y-3">
                      <p className="font-extrabold text-navy">{stu.name}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {indivCriteria.map((c) => (
                          <Field
                            key={c.key}
                            label={`${c.name} (${formatNumber(c.weight)}%)`}
                            id={`ind-${stu.id}-${c.key}`}
                          >
                            <Input
                              id={`ind-${stu.id}-${c.key}`}
                              type="number"
                              min="0"
                              max="100"
                              disabled={alreadySubmitted || lockedOtherStudent}
                              value={individualScores?.[stu.id]?.[c.key] ?? ''}
                              onChange={(e) =>
                                setIndividualScores((prev) => ({
                                  ...prev,
                                  [stu.id]: {
                                    ...(prev[stu.id] || {}),
                                    [c.key]: Number(e.target.value),
                                  },
                                }))
                              }
                            />
                          </Field>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!alreadySubmitted && (
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleSaveScores(false)}
                  loading={submitScores.isPending}
                >
                  {ar.evaluation.saveDraftScores}
                </Button>
                <Button
                  variant="gold"
                  onClick={() => handleSaveScores(true)}
                  loading={submitScores.isPending}
                >
                  {ar.evaluation.submitScores}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {allScores && (
        <Card title={ar.evaluation.allScoresTitle}>
          <div className="space-y-4">
            {allScores.spreadExceeded && (
              <div role="alert" className="flex items-start gap-3 rounded-xl bg-[#fef3c7] p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-[#b45309]" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-extrabold text-[#b45309]">
                    {t('evaluation.spreadWarning', { spread: formatNumber(allScores.maxSpread) })}
                  </p>
                  <p className="text-xs text-ink">
                    {t('evaluation.deliberationRoundLabel', {
                      count: formatNumber(defense.spreadFlag?.deliberationCount || 0),
                    })}
                  </p>
                </div>
              </div>
            )}

            <ResponsiveTable columns={scoresColumns} rows={allScores.examiners || []} />

            {isChair &&
              [DEFENSE_STATES.GRADING, DEFENSE_STATES.REEVALUATION_OPEN].includes(defense.state) && (
                <div className="space-y-3 border-t border-line pt-4">
                  <Field
                    label={
                      allScores.spreadExceeded
                        ? ar.evaluation.spreadNoteRequired
                        : ar.evaluation.finalizeNote
                    }
                    id="finalize-note"
                    required={allScores.spreadExceeded}
                  >
                    <Textarea
                      id="finalize-note"
                      value={finalizeNote}
                      onChange={(e) => setFinalizeNote(e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    {allScores.spreadExceeded &&
                      defense.state === DEFENSE_STATES.GRADING &&
                      (defense.spreadFlag?.deliberationCount || 0) < 3 && (
                        <Button
                          variant="outline"
                          onClick={() => handleTransition('UNLOCK_FOR_REVISION')}
                          loading={transitionDefense.isPending}
                        >
                          <Unlock className="h-4 w-4" aria-hidden="true" />
                          <span>{ar.evaluation.unlockForRevision}</span>
                        </Button>
                      )}
                    <Button
                      variant="navy"
                      onClick={() => handleTransition('FINALIZE')}
                      loading={transitionDefense.isPending}
                    >
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      <span>{ar.evaluation.finalizeGrades}</span>
                    </Button>
                  </div>
                </div>
              )}
          </div>
        </Card>
      )}

      <Card title={ar.evaluation.minutesSection}>
        {isChair ? (
          <form onSubmit={handleSaveMinutes} className="space-y-4">
            <Field label={ar.evaluation.minutesText} id="def-minutes" required>
              <Textarea
                id="def-minutes"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                required
              />
            </Field>
            <Field label={ar.evaluation.recommendationsText} id="def-recs">
              <Textarea
                id="def-recs"
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-bold text-navy">
              <input
                type="checkbox"
                checked={modRequired}
                onChange={(e) => setModRequired(e.target.checked)}
                className="h-4 w-4 accent-navy"
              />
              <span>{ar.evaluation.modificationsRequired}</span>
            </label>
            {modRequired && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={ar.evaluation.modificationsDescription} id="mod-desc">
                  <Input
                    id="mod-desc"
                    value={modDescription}
                    onChange={(e) => setModDescription(e.target.value)}
                  />
                </Field>
                <Field label={ar.evaluation.modificationsDeadline} id="mod-deadline">
                  <Input
                    id="mod-deadline"
                    type="date"
                    dir="ltr"
                    value={modDeadline}
                    onChange={(e) => setModDeadline(e.target.value)}
                  />
                </Field>
              </div>
            )}
            <Button type="submit" variant="navy" loading={recordMinutes.isPending}>
              {ar.common.save}
            </Button>
          </form>
        ) : (
          <div className="space-y-2 text-sm text-ink">
            <p>{defense.minutes || ar.common.noData}</p>
            {defense.recommendations && <p className="text-muted">{defense.recommendations}</p>}
          </div>
        )}

        {defense.modifications?.required && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-app-bg p-3">
            <div>
              <p className="text-xs font-bold text-muted">{ar.evaluation.modificationsStateLabel}</p>
              <p className="text-sm font-bold text-navy">{defense.modifications.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  defense.modifications.state === MODIFICATION_STATES.CONFIRMED
                    ? 'success'
                    : defense.modifications.state === MODIFICATION_STATES.OVERDUE
                      ? 'danger'
                      : 'warning'
                }
              >
                {defense.modifications.state === MODIFICATION_STATES.CONFIRMED
                  ? ar.evaluation.modStateConfirmed
                  : defense.modifications.state === MODIFICATION_STATES.OVERDUE
                    ? ar.evaluation.modStateOverdue
                    : ar.evaluation.modStatePending}
              </Badge>
              {isSupervisor && defense.modifications.state !== MODIFICATION_STATES.CONFIRMED && (
                <Button
                  size="sm"
                  variant="gold"
                  onClick={handleConfirmMods}
                  loading={confirmModifications.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{ar.evaluation.confirmModifications}</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
