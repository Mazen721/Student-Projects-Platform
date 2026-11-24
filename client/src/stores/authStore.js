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

// The assignment the user is currently acting as. The API authorizes every
// request against this context (x-role-context), so UI gating must use it
// too — checking any assignment the user holds shows controls and pages
// that belong to another post and fail or render empty under this context.
export function useActiveAssignment() {
  const roles = useAuthStore((s) => s.roles);
  const activeRoleId = useAuthStore((s) => s.activeRoleId);
  return roles.find((r) => String(r._id) === String(activeRoleId)) || roles[0] || null;
}

export function useActiveRole() {
  return useActiveAssignment()?.role ?? null;
}
