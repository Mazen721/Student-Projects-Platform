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

export function RtlYoYChart({
  title,
  subtitle,
  data = [],
  currentLabel = ar.reports.currentYear,
  compareLabel = ar.reports.compareYearLabel,
  suffix = '',
}) {
  const tableColumns = [
    { key: 'name', header: ar.common.details },
    {
      key: 'current',
      header: currentLabel,
      render: (row) => `${formatNumber(Number(row.current || 0), { decimals: 1 })}${suffix}`,
    },
    {
      key: 'comparison',
      header: compareLabel,
      render: (row) => `${formatNumber(Number(row.comparison || 0), { decimals: 1 })}${suffix}`,
    },
  ];

  return (
    <ChartContainer title={title} subtitle={subtitle} data={data} tableColumns={tableColumns}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 16 }}>
          <CartesianGrid stroke="#e3e9f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            reversed
            tick={{ fill: '#5b6b7c', fontSize: 12, fontFamily: 'Cairo, sans-serif' }}
          />
          <YAxis
            orientation="right"
            tickFormatter={(v) => formatNumber(Number(v))}
            tick={{ fill: '#5b6b7c', fontSize: 12, fontFamily: 'Cairo, sans-serif' }}
          />
          <Tooltip content={<RtlChartTooltip suffix={suffix} />} />
          <Legend wrapperStyle={{ fontFamily: 'Cairo, sans-serif', fontSize: 12 }} />
          <Bar dataKey="current" name={currentLabel} fill="#122f4a" radius={[6, 6, 0, 0]} />
          <Bar dataKey="comparison" name={compareLabel} fill="#c9a227" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
