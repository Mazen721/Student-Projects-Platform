import { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  { error = false, className = '', dir, ...rest },
  ref
) {
  const borderClass = error
    ? 'border-[#b91c1c] focus:border-transparent focus:ring-2 focus:ring-[#b91c1c]'
    : 'border-input-line focus:border-transparent focus:ring-2 focus:ring-gold';

  return (
    <input
      ref={ref}
      dir={dir}
      className={`min-h-11 w-full rounded-xl border-[1.5px] bg-white px-3.5 py-2 text-[0.95rem] text-ink outline-none transition placeholder:text-muted/70 disabled:bg-slate-100 disabled:opacity-60 ${borderClass} ${className}`}
      {...rest}
    />
  );
});
