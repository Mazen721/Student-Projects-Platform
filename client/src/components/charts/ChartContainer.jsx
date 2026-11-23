import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import ar from '@/locales/ar';
import { formatNumber } from '@/lib/format';
import { Card, EmptyState, ResponsiveTable } from '@/components/ui';

export function RtlChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-md"
    >
      {label && <p className="mb-1 font-extrabold text-navy">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((entry, idx) => (
          <li key={entry.dataKey || idx} className="flex items-center gap-2 text-ink">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color || '#122f4a' }}
            />
            <span className="text-muted">{entry.name}</span>
            <span className="font-bold text-navy">
              {typeof entry.value === 'number'
                ? `${formatNumber(entry.value, { decimals: 1 })}${suffix}`
                : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartContainer({
  title,
  subtitle,
  data = [],
  tableColumns = [],
  children,
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <Card
      title={title}
      subtitle={subtitle}
      actions={
        data.length > 0 && tableColumns.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowTable((prev) => !prev)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-navy hover:bg-slate-50 cursor-pointer"
          >
            {showTable ? (
              <>
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                <span>{ar.reports.showAsChart}</span>
              </>
            ) : (
              <>
                <Table2 className="h-4 w-4" aria-hidden="true" />
                <span>{ar.reports.showAsTable}</span>
              </>
            )}
          </button>
        ) : null
      }
    >
      {data.length === 0 ? (
        <EmptyState title={ar.common.noData} />
      ) : showTable ? (
        <ResponsiveTable columns={tableColumns} rows={data} />
      ) : (
        <div dir="ltr" className="h-72 w-full">
          {children}
        </div>
      )}
    </Card>
  );
}
