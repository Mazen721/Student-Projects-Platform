import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANT_CLASSES = {
  gold: 'bg-gold text-navy font-extrabold hover:bg-gold-light',
  navy: 'bg-navy text-white font-bold hover:bg-navy-light',
  outline: 'bg-white border-[1.5px] border-slate-300 text-ink font-bold hover:bg-slate-50',
  ghost: 'bg-transparent text-navy font-bold hover:bg-navy/5',
  danger: 'bg-[#b91c1c] text-white font-bold hover:bg-[#991b1b]',
};

const SIZE_CLASSES = {
  sm: 'min-h-11 px-3.5 py-2 text-sm',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
};

export const Button = forwardRef(function Button(
  {
    variant = 'gold',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    className = '',
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.gold} ${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
