import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ar from '@/locales/ar';
import { formatNumber } from '@/lib/format';
import { ChartContainer, RtlChartTooltip } from './ChartContainer';

export function RtlBarChart({
  title,
  subtitle,
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  valueLabel = ar.reports.countLabel,
  color = '#122f4a',
  suffix = '',
}) {
  const tableColumns = [
    { key: nameKey, header: ar.reports.unitName },
    {
      key: valueKey,
      header: valueLabel,
      render: (row) => `${formatNumber(Number(row[valueKey] || 0), { decimals: 1 })}${suffix}`,
    },
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
          <Tooltip content={<RtlChartTooltip suffix={suffix} />} />
          <Bar dataKey={valueKey} name={valueLabel} fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
