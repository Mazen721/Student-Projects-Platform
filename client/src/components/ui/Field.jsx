import { useId } from 'react';

export function Field({ id, label, error, hint, required = false, children, className = '' }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-[0.85rem] font-bold text-ink">
          {label}
          {required && <span className="ms-1 text-[#b91c1c] after:content-['*']" aria-hidden="true" />}
        </label>
      )}
      {typeof children === 'function'
        ? children({ id: fieldId, 'aria-invalid': Boolean(error), 'aria-describedby': errorId })
        : children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-semibold text-[#b91c1c]">
          {error}
        </p>
      )}
    </div>
  );
}
