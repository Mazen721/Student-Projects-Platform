import { useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { DEFENSE_STATES, MODIFICATION_STATES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatNumber } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  Field,
  Modal,
  ResponsiveTable,
  Textarea,
} from '@/components/ui';
import {
  downloadCertificateFile,
  useProjectGradesQuery,
  useRequestReevaluationMutation,
} from './evaluationApi';

export function StudentGradePage({ project }) {
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);

  const { data, isLoading } = useProjectGradesQuery(project.id);
  const requestReeval = useRequestReevaluationMutation();

  const [reevalOpen, setReevalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  if (isLoading) {
    return <CardSkeleton />;
  }

  if (!data?.finalized) {
    return <EmptyState title={ar.evaluation.grades} description={ar.evaluation.gradesNotFinalized} />;
  }

  const isPrimarySup = String(project.supervision?.primaryId || '') === String(user?.id || '');
  const canRequestReeval =
    data.defenseState === DEFENSE_STATES.FINALIZED &&
    ((data.myGrade && !data.myReevaluation) || isPrimarySup);

  async function handleDownload(studentId, studentName) {
    setDownloadingId(studentId);
    try {
      await downloadCertificateFile(
        project.id,
        studentId,
        `${ar.evaluation.certificate}-${studentName || 'student'}.pdf`
      );
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleSubmitReeval(e) {
    e.preventDefault();
    try {
      await requestReeval.mutateAsync({ projectId: project.id, reason });
      setReevalOpen(false);
      setReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const criterionColumns = [
    { key: 'name', header: ar.evaluation.criterionName },
    {
      key: 'weight',
      header: ar.evaluation.criterionWeight,
      render: (r) => `${formatNumber(r.weight)}%`,
    },
    {
      key: 'supervisor',
      header: ar.evaluation.supervisorTotal,
      render: (r) => formatNumber(r.supervisor),
    },
    {
      key: 'committeeAvg',
      header: ar.evaluation.committeeAvg,
      render: (r) => formatNumber(r.committeeAvg),
    },
  ];

  const staffColumns = [
    { key: 'studentName', header: ar.auth.name },
    {
      key: 'final',
      header: ar.evaluation.finalGrade,
      render: (r) => <span className="font-extrabold text-navy">{formatNumber(r.final)}</span>,
    },
    {
      key: 'teamGrade',
      header: ar.evaluation.teamGrade,
      render: (r) => formatNumber(r.teamGrade),
    },
    {
      key: 'bandLabel',
      header: ar.evaluation.gradeBandLabel,
      render: (r) => (
        <Badge tone={r.passed ? 'success' : 'danger'}>
          {r.bandLabel || t(`gradeBands.${r.band}`)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: ar.common.actions,
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          loading={downloadingId === r.studentId}
          onClick={() => handleDownload(r.studentId, r.studentName)}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>{ar.evaluation.certificate}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {data.modifications?.required &&
        data.modifications.state !== MODIFICATION_STATES.CONFIRMED && (
          <div className="rounded-xl bg-[#fef3c7] p-4 text-sm font-bold text-[#b45309]">
            {ar.evaluation.certificatePendingModsNote}
          </div>
        )}

      {data.myGrade && (
        <>
          <Card
            title={ar.evaluation.grades}
            subtitle={formatDate(data.finalizedAt)}
            actions={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="gold"
                  loading={downloadingId === data.myGrade.studentId}
                  onClick={() => handleDownload(data.myGrade.studentId, data.myGrade.studentName)}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>{ar.evaluation.downloadCertificate}</span>
                </Button>
                {canRequestReeval && (
                  <Button variant="outline" onClick={() => setReevalOpen(true)}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>{ar.evaluation.reevaluation}</span>
                  </Button>
                )}
              </div>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-navy p-4 text-white">
                <p className="text-xs text-gold-light">{ar.evaluation.finalGrade}</p>
                <p className="mt-1 text-3xl font-black">{formatNumber(data.myGrade.final)}</p>
              </div>
              <div className="rounded-xl border border-line bg-app-bg p-4">
                <p className="text-xs text-muted">{ar.evaluation.gradeBandLabel}</p>
                <div className="mt-2">
                  <Badge tone={data.myGrade.passed ? 'success' : 'danger'}>
                    {data.myGrade.bandLabel}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-app-bg p-4">
                <p className="text-xs text-muted">{ar.evaluation.teamGrade}</p>
                <p className="mt-1 text-2xl font-black text-navy">
                  {formatNumber(data.myGrade.teamGrade)}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-app-bg p-4">
                <p className="text-xs text-muted">{ar.evaluation.supervisorTotal}</p>
                <p className="mt-1 text-lg font-extrabold text-navy">
                  {formatNumber(data.myGrade.supervisorTotal)} · {ar.evaluation.committeeAvg}:{' '}
                  {formatNumber(data.myGrade.committeeAvg)}
                </p>
              </div>
            </div>
          </Card>

          <Card title={ar.evaluation.criterionBreakdown}>
            <ResponsiveTable
              columns={criterionColumns}
              rows={data.myGrade.perCriterion || []}
            />
          </Card>
        </>
      )}

      {Array.isArray(data.grades) && (
        <Card
          title={ar.evaluation.grades}
          subtitle={formatDate(data.finalizedAt)}
          actions={
            canRequestReeval ? (
              <Button variant="outline" onClick={() => setReevalOpen(true)}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>{ar.evaluation.reevaluation}</span>
              </Button>
            ) : null
          }
        >
          <ResponsiveTable columns={staffColumns} rows={data.grades} />
        </Card>
      )}

      <Modal open={reevalOpen} onClose={() => setReevalOpen(false)} title={ar.evaluation.reevaluation}>
        <form onSubmit={handleSubmitReeval} className="space-y-4">
          <Field label={ar.evaluation.reevaluationReason} id="reeval-reason" required>
            <Textarea
              id="reeval-reason"
              minLength={10}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReevalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={requestReeval.isPending}>
              {ar.evaluation.submitReevaluation}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
