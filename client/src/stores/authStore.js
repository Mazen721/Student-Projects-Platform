import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  accessToken: null,
  user: null,
  roles: [],
  activeRoleId: null,
  initialized: false,

  setSession({ accessToken, user }) {
    const roles = Array.isArray(user?.roles) ? user.roles : get().roles;
    const currentActive = get().activeRoleId;
    const hasCurrent = roles.some((r) => String(r._id) === String(currentActive));
    set({
      accessToken: accessToken ?? null,
      user: user ?? null,
      roles,
      activeRoleId: hasCurrent ? currentActive : roles[0]?._id ?? null,
      initialized: true,
    });
  },

  setAccessToken(accessToken) {
    set({ accessToken });
  },

  setActiveRoleId(activeRoleId) {
    set({ activeRoleId });
  },

  markInitialized() {
    set({ initialized: true });
  },

  clearSession() {
    set({
      accessToken: null,
      user: null,
      roles: [],
      activeRoleId: null,
      initialized: true,
    });
  },
}));
