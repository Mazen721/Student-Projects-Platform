import { forwardRef } from 'react';
import ar from '@/locales/ar';

export const Select = forwardRef(function Select(
  { error = false, options = [], placeholder, className = '', children, ...rest },
  ref
) {
  const borderClass = error
    ? 'border-[#b91c1c] focus:border-transparent focus:ring-2 focus:ring-[#b91c1c]'
    : 'border-input-line focus:border-transparent focus:ring-2 focus:ring-gold';

  return (
    <select
      ref={ref}
      className={`min-h-11 w-full rounded-xl border-[1.5px] bg-white px-3.5 py-2 text-[0.95rem] text-ink outline-none transition disabled:bg-slate-100 disabled:opacity-60 ${borderClass} ${className}`}
      {...rest}
    >
      {placeholder !== false && (
        <option value="">{placeholder || ar.common.selectPlaceholder}</option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {children}
    </select>
  );
});
