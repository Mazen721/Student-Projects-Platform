import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatNumber } from '@/lib/format';
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
  Select,
  Textarea,
} from '@/components/ui';
import {
  useAvailableExaminersQuery,
  useDecideReevaluationMutation,
  useReevaluationsQuery,
} from './evaluationApi';

function getStatusTone(status) {
  if (status === 'approved' || status === 'completed') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

export default function ReEvaluationQueuePage() {
  const addToast = useUiStore((s) => s.addToast);
  const { data, isLoading } = useReevaluationsQuery({ limit: 50 });
  const decideMutation = useDecideReevaluationMutation();

  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('approve');
  const [note, setNote] = useState('');
  const [chairId, setChairId] = useState('');

  const { data: examiners = [] } = useAvailableExaminersQuery(
    selected?.projectId,
    Boolean(selected && decision === 'approve')
  );

  const items = data?.data || [];

  function openDecideModal(row) {
    setSelected(row);
    setDecision('approve');
    setNote('');
    setChairId('');
  }

  async function handleDecide(e) {
    e.preventDefault();
    try {
      await decideMutation.mutateAsync({
        id: selected.id,
        decision,
        note,
        ...(decision === 'approve' && chairId
          ? { replacementCommittee: { chairId, memberIds: [] } }
          : {}),
      });
      setSelected(null);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const columns = [
    { key: 'projectTitle', header: ar.projects.title },
    { key: 'requesterName', header: ar.auth.name },
    {
      key: 'scope',
      header: ar.common.details,
      render: (r) =>
        r.scope === 'project'
          ? ar.evaluation.reevaluationScopeProject
          : ar.evaluation.reevaluationScopeStudent,
    },
    { key: 'reason', header: ar.evaluation.reevaluationReason },
    {
      key: 'oldGrades',
      header: ar.evaluation.finalGrade,
      render: (r) =>
        (r.oldGrades || []).map((g) => formatNumber(g.final)).join(' · '),
    },
    {
      key: 'createdAt',
      header: ar.org.auditTime,
      render: (r) => formatDate(r.createdAt),
    },
    {
      key: 'status',
      header: ar.common.status,
      render: (r) => (
        <Badge tone={getStatusTone(r.status)}>{t(`statuses.${r.status}`)}</Badge>
      ),
    },
    {
      key: 'actions',
      header: ar.common.actions,
      render: (r) =>
        r.status === 'pending' ? (
          <Button size="sm" variant="gold" onClick={() => openDecideModal(r)}>
            {ar.evaluation.decideReevaluation}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.evaluation.reevaluationQueue} — ${ar.common.platformName}`} />

      <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold">{ar.evaluation.reevaluationQueue}</h1>
      </header>

      {isLoading ? (
        <CardSkeleton />
      ) : items.length === 0 ? (
        <EmptyState title={ar.evaluation.reevaluationQueue} />
      ) : (
        <Card>
          <ResponsiveTable columns={columns} rows={items} />
        </Card>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={ar.evaluation.decideReevaluation}
      >
        <form onSubmit={handleDecide} className="space-y-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant={decision === 'approve' ? 'navy' : 'outline'}
              onClick={() => setDecision('approve')}
            >
              {ar.evaluation.approveReevaluation}
            </Button>
            <Button
              type="button"
              variant={decision === 'reject' ? 'danger' : 'outline'}
              onClick={() => setDecision('reject')}
            >
              {ar.evaluation.rejectReevaluation}
            </Button>
          </div>

          <Field label={ar.evaluation.decisionNote} id="reeval-note" required>
            <Textarea
              id="reeval-note"
              minLength={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
            />
          </Field>

          {decision === 'approve' && (
            <Field label={ar.evaluation.replacementCommitteeOptional} id="reeval-chair">
              <Select
                id="reeval-chair"
                value={chairId}
                onChange={(e) => setChairId(e.target.value)}
              >
                <option value="">{ar.common.selectPlaceholder}</option>
                {examiners.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={decideMutation.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
