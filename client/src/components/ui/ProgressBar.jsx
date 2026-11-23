import { formatPercent } from '@/lib/format';

export function ProgressBar({ value = 0, label, showPercent = true, className = '' }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const percentText = formatPercent(clamped);

  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
          {label && <span className="text-muted">{label}</span>}
          {showPercent && <span className="text-navy">{percentText}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || percentText}
        className="h-2.5 w-full overflow-hidden rounded-full bg-[#e7edf3]"
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-gold to-gold-light transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
