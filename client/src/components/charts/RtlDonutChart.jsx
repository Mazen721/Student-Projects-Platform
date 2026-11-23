import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import ar from '@/locales/ar';
import { formatNumber } from '@/lib/format';
import { ChartContainer, RtlChartTooltip } from './ChartContainer';

const DEFAULT_COLORS = ['#15803d', '#b45309', '#b91c1c', '#122f4a', '#c9a227'];

export function RtlDonutChart({
  title,
  subtitle,
  data = [],
  colors = DEFAULT_COLORS,
}) {
  const tableColumns = [
    { key: 'name', header: ar.common.status },
    {
      key: 'value',
      header: ar.reports.countLabel,
      render: (row) => formatNumber(Number(row.value || 0)),
    },
  ];

  return (
    <ChartContainer title={title} subtitle={subtitle} data={data} tableColumns={tableColumns}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={88}
            paddingAngle={2}
          >
            {data.map((entry, idx) => (
              <Cell key={entry.name} fill={entry.color || colors[idx % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<RtlChartTooltip />} />
          <Legend wrapperStyle={{ fontFamily: 'Cairo, sans-serif', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
