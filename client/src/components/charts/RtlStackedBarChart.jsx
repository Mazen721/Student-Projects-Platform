import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ar from '@/locales/ar';
import { formatNumber } from '@/lib/format';
import { ChartContainer, RtlChartTooltip } from './ChartContainer';

export function RtlStackedBarChart({
  title,
  subtitle,
  data = [],
  nameKey = 'name',
  series = [],
}) {
  const tableColumns = [
    { key: nameKey, header: ar.reports.unitName },
    ...series.map((s) => ({
      key: s.key,
      header: s.label,
      render: (row) => formatNumber(Number(row[s.key] || 0)),
    })),
  ];

  return (
    <ChartContainer title={title} subtitle={subtitle} data={data} tableColumns={tableColumns}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 16 }}>
          <CartesianGrid stroke="#e3e9f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={nameKey}
            reversed
            tick={{ fill: '#5b6b7c', fontSize: 12, fontFamily: 'Cairo, sans-serif' }}
          />
          <YAxis
            orientation="right"
            tickFormatter={(v) => formatNumber(Number(v))}
            tick={{ fill: '#5b6b7c', fontSize: 12, fontFamily: 'Cairo, sans-serif' }}
          />
          <Tooltip content={<RtlChartTooltip />} />
          <Legend wrapperStyle={{ fontFamily: 'Cairo, sans-serif', fontSize: 12 }} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="stack"
              fill={s.color}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
