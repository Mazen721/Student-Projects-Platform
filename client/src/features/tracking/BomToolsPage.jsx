import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BOM_STATUS_VALUES, PROPOSAL_STATUSES, TOOL_CATEGORY_VALUES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatCurrencyEgp, formatNumber } from '@/lib/format';
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
  ResponsiveTable,
  Select,
} from '@/components/ui';
import {
  useBomQuery,
  useCreateBomMutation,
  useCreateToolMutation,
  useDeleteBomMutation,
  useDeleteToolMutation,
  useToolsQuery,
  useUpdateBomMutation,
} from './trackingApi';

export function BomToolsPage({ project }) {
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);

  const { data: bomData, isLoading: bomLoading } = useBomQuery(project.id);
  const { data: tools = [], isLoading: toolsLoading } = useToolsQuery(project.id);
  const createBom = useCreateBomMutation();
  const updateBom = useUpdateBomMutation();
  const deleteBom = useDeleteBomMutation();
  const createTool = useCreateToolMutation();
  const deleteTool = useDeleteToolMutation();

  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [bomForm, setBomForm] = useState({
    item: '',
    quantity: 1,
    unitPrice: 0,
    specs: '',
    supplier: '',
    status: 'needed',
  });

  const [toolModalOpen, setToolModalOpen] = useState(false);
  const [toolForm, setToolForm] = useState({ category: 'framework', name: '', version: '' });

  const isTeamMember = (project.activeMemberIds || []).includes(String(user?.id));
  const canWrite = isTeamMember && project.status !== PROPOSAL_STATUSES.ARCHIVED;

  if (bomLoading || toolsLoading) return <CardSkeleton />;

  const bomItems = bomData?.items || [];
  const budgetEstimate = bomData?.budgetEstimate ?? project.budgetEstimate ?? 0;

  async function handleAddBom(e) {
    e.preventDefault();
    try {
      await createBom.mutateAsync({
        projectId: project.id,
        item: bomForm.item,
        quantity: Number(bomForm.quantity),
        unitPrice: Number(bomForm.unitPrice),
        ...(bomForm.specs.trim() ? { specs: bomForm.specs.trim() } : {}),
        ...(bomForm.supplier.trim() ? { supplier: bomForm.supplier.trim() } : {}),
        status: bomForm.status,
      });
      setBomModalOpen(false);
      setBomForm({ item: '', quantity: 1, unitPrice: 0, specs: '', supplier: '', status: 'needed' });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleStatusChange(itemId, status) {
    try {
      await updateBom.mutateAsync({ itemId, projectId: project.id, status });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleDeleteBom(itemId) {
    try {
      await deleteBom.mutateAsync({ itemId, projectId: project.id });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleAddTool(e) {
    e.preventDefault();
    try {
      await createTool.mutateAsync({
        projectId: project.id,
        category: toolForm.category,
        name: toolForm.name,
        ...(toolForm.version.trim() ? { version: toolForm.version.trim() } : {}),
      });
      setToolModalOpen(false);
      setToolForm({ category: 'framework', name: '', version: '' });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleDeleteTool(toolId) {
    try {
      await deleteTool.mutateAsync({ toolId, projectId: project.id });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const bomColumns = [
    { key: 'item', header: ar.tracking.bomItemName },
    {
      key: 'quantity',
      header: ar.tracking.bomQuantity,
      render: (row) => formatNumber(row.quantity),
    },
    {
      key: 'unitPrice',
      header: ar.tracking.bomUnitPrice,
      render: (row) => formatCurrencyEgp(row.unitPrice),
    },
    {
      key: 'subtotal',
      header: ar.tracking.bomTotalBudget,
      render: (row) => formatCurrencyEgp(Number(row.quantity) * Number(row.unitPrice)),
    },
    {
      key: 'status',
      header: ar.tracking.bomStatus,
      render: (row) =>
        canWrite ? (
          <Select
            aria-label={ar.tracking.bomStatus}
            value={row.status}
            onChange={(e) => handleStatusChange(row.id, e.target.value)}
          >
            {BOM_STATUS_VALUES.map((st) => (
              <option key={st} value={st}>
                {t(`tracking.bomStatuses.${st}`)}
              </option>
            ))}
          </Select>
        ) : (
          <Badge tone="info">{t(`tracking.bomStatuses.${row.status}`)}</Badge>
        ),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: ar.common.actions,
            render: (row) => (
              <Button
                size="sm"
                variant="ghost"
                aria-label={ar.common.delete}
                onClick={() => handleDeleteBom(row.id)}
              >
                <Trash2 className="h-4 w-4 text-[#b91c1c]" aria-hidden="true" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <Card
        title={ar.tracking.bom}
        subtitle={`${ar.tracking.bomTotalBudget}: ${formatCurrencyEgp(budgetEstimate)}`}
        actions={
          canWrite ? (
            <Button variant="gold" size="sm" onClick={() => setBomModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{ar.tracking.addBomItem}</span>
            </Button>
          ) : null
        }
      >
        <ResponsiveTable columns={bomColumns} rows={bomItems} />
      </Card>

      <Card
        title={ar.tracking.tools}
        actions={
          canWrite ? (
            <Button variant="navy" size="sm" onClick={() => setToolModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{ar.tracking.addTool}</span>
            </Button>
          ) : null
        }
      >
        {tools.length === 0 ? (
          <EmptyState title={ar.tracking.tools} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-app-bg p-3"
              >
                <div className="space-y-1">
                  <p className="font-bold text-navy">{tool.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{t(`tracking.toolCategories.${tool.category}`)}</Badge>
                    {tool.version && <span className="text-xs text-muted">{tool.version}</span>}
                  </div>
                </div>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={ar.common.delete}
                    onClick={() => handleDeleteTool(tool.id)}
                  >
                    <Trash2 className="h-4 w-4 text-[#b91c1c]" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={bomModalOpen} onClose={() => setBomModalOpen(false)} title={ar.tracking.addBomItem}>
        <form onSubmit={handleAddBom} className="space-y-4">
          <Field label={ar.tracking.bomItemName} id="bom-item" required>
            <Input
              id="bom-item"
              value={bomForm.item}
              onChange={(e) => setBomForm((b) => ({ ...b, item: e.target.value }))}
              required
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={ar.tracking.bomQuantity} id="bom-qty" required>
              <Input
                id="bom-qty"
                type="number"
                min="1"
                value={bomForm.quantity}
                onChange={(e) => setBomForm((b) => ({ ...b, quantity: e.target.value }))}
                required
              />
            </Field>
            <Field label={ar.tracking.bomUnitPrice} id="bom-price" required>
              <Input
                id="bom-price"
                type="number"
                min="0"
                step="0.01"
                value={bomForm.unitPrice}
                onChange={(e) => setBomForm((b) => ({ ...b, unitPrice: e.target.value }))}
                required
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={ar.tracking.bomSupplier} id="bom-sup">
              <Input
                id="bom-sup"
                value={bomForm.supplier}
                onChange={(e) => setBomForm((b) => ({ ...b, supplier: e.target.value }))}
              />
            </Field>
            <Field label={ar.tracking.bomStatus} id="bom-status">
              <Select
                id="bom-status"
                value={bomForm.status}
                onChange={(e) => setBomForm((b) => ({ ...b, status: e.target.value }))}
              >
                {BOM_STATUS_VALUES.map((st) => (
                  <option key={st} value={st}>
                    {t(`tracking.bomStatuses.${st}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={ar.tracking.bomSpecs} id="bom-specs">
            <Input
              id="bom-specs"
              value={bomForm.specs}
              onChange={(e) => setBomForm((b) => ({ ...b, specs: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBomModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={createBom.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={toolModalOpen} onClose={() => setToolModalOpen(false)} title={ar.tracking.addTool}>
        <form onSubmit={handleAddTool} className="space-y-4">
          <Field label={ar.tracking.toolCategory} id="tool-cat">
            <Select
              id="tool-cat"
              value={toolForm.category}
              onChange={(e) => setToolForm((tf) => ({ ...tf, category: e.target.value }))}
            >
              {TOOL_CATEGORY_VALUES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`tracking.toolCategories.${cat}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={ar.tracking.toolName} id="tool-name" required>
            <Input
              id="tool-name"
              value={toolForm.name}
              onChange={(e) => setToolForm((tf) => ({ ...tf, name: e.target.value }))}
              required
            />
          </Field>
          <Field label={ar.tracking.toolVersion} id="tool-ver">
            <Input
              id="tool-ver"
              value={toolForm.version}
              onChange={(e) => setToolForm((tf) => ({ ...tf, version: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setToolModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={createTool.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
