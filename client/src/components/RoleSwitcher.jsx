import { useQueryClient } from '@tanstack/react-query';
import ar, { t } from '@/locales/ar';
import { useAuthStore } from '@/stores/authStore';
import { Select } from '@/components/ui';

export function RoleSwitcher({ compact = false }) {
  const queryClient = useQueryClient();
  const roles = useAuthStore((s) => s.roles);
  const activeRoleId = useAuthStore((s) => s.activeRoleId);
  const setActiveRoleId = useAuthStore((s) => s.setActiveRoleId);

  if (!Array.isArray(roles) || roles.length <= 1) {
    return null;
  }

  function handleChange(event) {
    setActiveRoleId(event.target.value);
    // Every query is authorized against the active context, so all cached
    // data belongs to the previous post — invalidate everything.
    queryClient.invalidateQueries();
  }

  return (
    <div className={compact ? 'min-w-[10rem]' : 'w-full'}>
      <label className="sr-only" htmlFor="role-switcher-select">
        {ar.nav.roleContext}
      </label>
      <Select
        id="role-switcher-select"
        aria-label={ar.nav.roleContext}
        placeholder={false}
        value={activeRoleId || String(roles[0]._id)}
        onChange={handleChange}
        options={roles.map((r) => ({
          value: String(r._id),
          label: t(`roles.${r.role}`),
        }))}
      />
    </div>
  );
}
