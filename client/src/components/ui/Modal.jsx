import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import ar from '@/locales/ar';

export function Modal({ open, onClose, title, children, footer, className = '' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    panelRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-dark/50 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title || ar.common.details}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`max-h-[90dvh] w-full overflow-y-auto rounded-t-[1.25rem] bg-white p-5 shadow-xl outline-none md:max-w-lg md:rounded-2xl ${className}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
          {title && <h2 className="text-lg font-extrabold text-navy">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label={ar.common.closeDialog}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted transition hover:bg-slate-100 hover:text-navy cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-4">{footer}</div>}
      </div>
    </div>
  );
}
