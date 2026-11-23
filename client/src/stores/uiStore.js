import { create } from 'zustand';

let nextToastId = 1;

export const useUiStore = create((set) => ({
  toasts: [],
  moreDrawerOpen: false,
  socketReconnecting: false,

  setMoreDrawerOpen(open) {
    set({ moreDrawerOpen: Boolean(open) });
  },

  setSocketReconnecting(reconnecting) {
    set({ socketReconnecting: Boolean(reconnecting) });
  },

  addToast({ message, tone = 'info', durationMs = 4500 }) {
    const id = nextToastId++;
    set((state) => ({
      toasts: [...state.toasts, { id, message, tone }],
    }));
    if (durationMs > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, durationMs);
    }
    return id;
  },

  dismissToast(id) {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
