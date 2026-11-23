import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { WEIGHT_TOLERANCE } from '@spp/shared/constants';
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
  FileUploader,
  Input,
  Modal,
} from '@/components/ui';
import {
  useCreatePhaseTemplateMutation,
  usePhaseTemplatesQuery,
} from './trackingApi';

function createEmptyPhase(order) {
  return {
    key: `phase_${order}`,
    name: '',
    order,
    weight: order === 1 ? 100 : 0,
    dueOffsetDays: order * 30,
    requiredDeliverables: [{ key: `deliv_${order}_1`, title: '' }],
    forms: [],
  };
}

export default function PhaseTemplatesPage() {
  const { collegeId } = useParams();
  const addToast = useUiStore((s) => s.addToast);
  const { data: templates = [], isLoading } = usePhaseTemplatesQuery(collegeId);
  const createTemplate = useCreatePhaseTemplateMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [phases, setPhases] = useState([createEmptyPhase(1)]);

  const totalWeight = phases.reduce((sum, p) => sum + Number(p.weight || 0), 0);
  const weightsValid = Math.abs(totalWeight - 100) <= WEIGHT_TOLERANCE;

  function openNewModal() {
    setName('');
    setIsDefault(true);
    setPhases([createEmptyPhase(1)]);
    setModalOpen(true);
  }

  function updatePhase(index, patch) {
    setPhases((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPhaseRow() {
    setPhases((prev) => [...prev, createEmptyPhase(prev.length + 1)]);
  }

  function removePhaseRow(index) {
    setPhases((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, order: i + 1 }))
    );
  }

  function addDeliverableDef(phaseIdx) {
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIdx
          ? {
              ...p,
              requiredDeliverables: [
                ...p.requiredDeliverables,
                { key: `deliv_${i + 1}_${p.requiredDeliverables.length + 1}`, title: '' },
              ],
            }
          : p
      )
    );
  }

  function updateDeliverableDef(phaseIdx, delivIdx, title) {
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIdx
          ? {
              ...p,
              requiredDeliverables: p.requiredDeliverables.map((d, di) =>
                di === delivIdx ? { ...d, title } : d
              ),
            }
          : p
      )
    );
  }

  function addFormToPhase(phaseIdx, uploadResult) {
    setPhases((prev) =>
      prev.map((p, i) => (i === phaseIdx ? { ...p, forms: [...p.forms, uploadResult] } : p))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!weightsValid) {
      addToast({ message: ar.validation.weightsSum100, tone: 'error' });
      return;
    }
    try {
      await createTemplate.mutateAsync({
        collegeId,
        name,
        isDefault,
        phases: phases.map((p) => ({
          ...p,
          weight: Number(p.weight),
          dueOffsetDays: Number(p.dueOffsetDays || 30),
          requiredDeliverables: p.requiredDeliverables.filter((d) => d.title.trim().length > 0),
        })),
      });
      setModalOpen(false);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.tracking.phaseTemplates} — ${ar.common.platformName}`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">{ar.tracking.phaseTemplates}</h1>
        </div>
        <Button variant="gold" onClick={openNewModal}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{ar.tracking.newTemplate}</span>
        </Button>
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : templates.length === 0 ? (
        <EmptyState
          title={ar.tracking.phaseTemplates}
          actionLabel={ar.tracking.newTemplate}
          onAction={openNewModal}
        />
      ) : (
        <div className="space-y-4">
          {templates.map((tpl) => (
            <Card
              key={tpl.id}
              title={tpl.name}
              actions={
                tpl.isDefault ? (
                  <Badge tone="featured">{ar.tracking.isDefaultTemplate}</Badge>
                ) : null
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                {(tpl.phases || []).map((phase) => (
                  <div
                    key={phase.key}
                    className="rounded-xl border border-line bg-app-bg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-navy">{phase.name}</span>
                      <Badge tone="info">{formatPercent(phase.weight, { decimals: 0 })}</Badge>
                    </div>
                    {(phase.requiredDeliverables || []).length > 0 && (
                      <ul className="list-disc space-y-1 ps-5 text-xs text-ink">
                        {phase.requiredDeliverables.map((d) => (
                          <li key={d.key}>{d.title}</li>
                        ))}
                      </ul>
                    )}
                    {(phase.forms || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {phase.forms.map((f, idx) => (
                          <a
                            key={idx}
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-navy border border-line"
                          >
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{f.originalName || ar.tracking.downloadForm}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={ar.tracking.newTemplate}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={ar.tracking.templateName} id="tpl-name" required>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <label className="flex items-center gap-2 text-sm font-bold text-navy">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 accent-navy"
            />
            <span>{ar.tracking.isDefaultTemplate}</span>
          </label>

          <div className="flex items-center justify-between">
            <Badge tone={weightsValid ? 'success' : 'danger'}>
              {t('tracking.weightsTotal', { total: formatNumber(totalWeight) })}
            </Badge>
            <Button type="button" size="sm" variant="outline" onClick={addPhaseRow}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{ar.tracking.addPhase}</span>
            </Button>
          </div>

          <div className="max-h-80 space-y-3 overflow-y-auto pe-1">
            {phases.map((phase, idx) => (
              <div key={phase.key} className="rounded-xl border border-line p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-navy">
                    {ar.tracking.phases} ({formatNumber(idx + 1)})
                  </span>
                  {phases.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={ar.common.delete}
                      onClick={() => removePhaseRow(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-[#b91c1c]" aria-hidden="true" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label={ar.tracking.phaseName} id={`ph-name-${idx}`} required>
                    <Input
                      id={`ph-name-${idx}`}
                      value={phase.name}
                      onChange={(e) => updatePhase(idx, { name: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={ar.tracking.phaseWeight} id={`ph-weight-${idx}`} required>
                    <Input
                      id={`ph-weight-${idx}`}
                      type="number"
                      min="0"
                      max="100"
                      value={phase.weight}
                      onChange={(e) => updatePhase(idx, { weight: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={ar.tracking.dueOffsetDays} id={`ph-days-${idx}`}>
                    <Input
                      id={`ph-days-${idx}`}
                      type="number"
                      min="1"
                      max="365"
                      value={phase.dueOffsetDays}
                      onChange={(e) => updatePhase(idx, { dueOffsetDays: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted">
                      {ar.tracking.requiredDeliverables}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => addDeliverableDef(idx)}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{ar.tracking.addDeliverableDef}</span>
                    </Button>
                  </div>
                  {phase.requiredDeliverables.map((d, di) => (
                    <Input
                      key={d.key}
                      aria-label={ar.tracking.deliverableTitle}
                      placeholder={ar.tracking.deliverableTitle}
                      value={d.title}
                      onChange={(e) => updateDeliverableDef(idx, di, e.target.value)}
                    />
                  ))}
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-bold text-muted">
                    {ar.tracking.officialForms}
                  </span>
                  <FileUploader
                    purpose="form"
                    onUploaded={(res) => addFormToPhase(idx, res)}
                    onError={(msg) => addToast({ message: msg, tone: 'error' })}
                  />
                  {phase.forms.length > 0 && (
                    <p className="text-xs font-semibold text-navy">
                      {phase.forms.map((f) => f.original_filename).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={createTemplate.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
