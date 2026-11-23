import { cloneElement, isValidElement, useId } from 'react';

export function Field({ id, label, error, hint, required = false, children, className = '' }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;

  let renderedChildren = children;
  if (typeof children === 'function') {
    renderedChildren = children({
      id: fieldId,
      'aria-invalid': Boolean(error),
      'aria-describedby': errorId,
    });
  } else if (isValidElement(children) && typeof children.type !== 'string' && !children.props?.id) {
    renderedChildren = cloneElement(children, {
      id: fieldId,
      ...(errorId && !children.props?.['aria-describedby'] ? { 'aria-describedby': errorId } : {}),
    });
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-[0.85rem] font-bold text-ink">
          {label}
          {required && <span className="ms-1 text-[#b91c1c] after:content-['*']" aria-hidden="true" />}
        </label>
      )}
      {renderedChildren}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-semibold text-[#b91c1c]">
          {error}
        </p>
      )}
    </div>
  );
}
