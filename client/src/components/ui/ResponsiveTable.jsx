import ar from '@/locales/ar';

export function ResponsiveTable({
  columns = [],
  rows = [],
  rowKey = (row, idx) => row.id || row._id || idx,
  emptyMessage,
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">
        {emptyMessage || ar.common.noData}
      </div>
    );
  }

  return (
    <div>
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white md:block">
        <table className="w-full border-collapse text-start text-sm">
          <thead>
            <tr className="bg-navy text-white">
              {columns.map((col) => (
                <th key={col.key} scope="col" className="px-4 py-3 text-start font-bold">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowKey(row, rowIndex)}
                className={`border-t border-line ${rowIndex % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-start text-ink">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row, rowIndex) => (
          <div
            key={rowKey(row, rowIndex)}
            className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_3px_rgba(18,47,74,0.05)]"
          >
            <dl className="space-y-2 text-sm">
              {columns.map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-xs font-bold text-muted">{col.header}</dt>
                  <dd className="text-end text-ink">
                    {col.render ? col.render(row) : row[col.key]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
