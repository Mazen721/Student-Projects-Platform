import { useEffect } from 'react';
import { X } from 'lucide-react';
import ar from '@/locales/ar';

export function Drawer({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start bg-navy-dark/50"
      role="dialog"
      aria-modal="true"
      aria-label={title || ar.common.more}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <aside className="flex h-full w-80 max-w-[85vw] flex-col bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          {title && <h2 className="text-base font-extrabold text-navy">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label={ar.common.closeDialog}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted hover:bg-slate-100 hover:text-navy cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
