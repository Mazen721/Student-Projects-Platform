import { X } from 'lucide-react';
import ar from '@/locales/ar';
import { useUiStore } from '@/stores/uiStore';

const TONE_STYLES = {
  success: 'border-[#15803d]/30 bg-[#dcfce7] text-[#15803d]',
  warning: 'border-[#b45309]/30 bg-[#fef3c7] text-[#b45309]',
  error: 'border-[#b91c1c]/30 bg-[#fee2e2] text-[#b91c1c]',
  info: 'border-navy/20 bg-white text-navy',
};

export function ToastContainer() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 end-4 z-50 flex w-full max-w-sm flex-col gap-2 lg:bottom-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-lg ${TONE_STYLES[toast.tone] || TONE_STYLES.info}`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label={ar.common.close}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-black/5 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
