import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDashboardHomeQuery(activeRoleId) {
  return useQuery({
    queryKey: ['dashboard', 'home', activeRoleId],
    queryFn: async () => {
      const res = await api.get('/dashboard/home');
      return res.data.data;
    },
  });
}

export function useUniversityQuery(enabled = true) {
  return useQuery({
    queryKey: ['university'],
    enabled,
    queryFn: async () => {
      const res = await api.get('/university');
      return res.data.data;
    },
  });
}

export function useUpdateUniversityMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.patch('/university/settings', payload);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['university'] }),
  });
}

export function useCollegesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ['colleges', params],
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const res = await api.get('/colleges', { params });
      return res.data;
    },
  });
}

export function useCreateCollegeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/colleges', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleges'] }),
  });
}

export function useUpdateCollegeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.patch(`/colleges/${id}`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleges'] }),
  });
}

export function useUpdateCollegeSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) =>
      (await api.patch(`/colleges/${id}/settings`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleges'] }),
  });
}

export function useDeactivateCollegeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) =>
      (await api.post(`/colleges/${id}/deactivate`, { reason })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleges'] }),
  });
}

export function useDepartmentsQuery(collegeId, options = {}) {
  return useQuery({
    queryKey: ['colleges', collegeId, 'departments'],
    enabled: Boolean(collegeId) && (options.enabled ?? true),
    queryFn: async () => (await api.get(`/colleges/${collegeId}/departments`)).data,
  });
}

export function useCreateDepartmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collegeId, ...payload }) =>
      (await api.post(`/colleges/${collegeId}/departments`, payload)).data.data,
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['colleges', vars.collegeId, 'departments'] }),
  });
}

export function useUpdateDepartmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) =>
      (await api.patch(`/departments/${id}`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleges'] }),
  });
}

export function useDeactivateDepartmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) =>
      (await api.post(`/departments/${id}/deactivate`, { reason })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleges'] }),
  });
}

export function useAcademicYearsQuery(collegeId) {
  return useQuery({
    queryKey: ['colleges', collegeId, 'academic-years'],
    enabled: Boolean(collegeId),
    queryFn: async () => (await api.get(`/colleges/${collegeId}/academic-years`)).data.data,
  });
}

export function useCreateAcademicYearMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collegeId, ...payload }) =>
      (await api.post(`/colleges/${collegeId}/academic-years`, payload)).data.data,
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['colleges', vars.collegeId, 'academic-years'] }),
  });
}

export function useSetCurrentYearMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/academic-years/${id}/set-current`, {})).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleges'] }),
  });
}

export function useRolloverYearMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/academic-years/${id}/rollover`, {})).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleges'] }),
  });
}

export function useUsersQuery(params = {}) {
  return useQuery({
    queryKey: ['users', 'list', params],
    queryFn: async () => (await api.get('/users', { params })).data,
  });
}

export function usePendingInvestorsQuery(enabled = true) {
  return useQuery({
    queryKey: ['investors', 'pending'],
    enabled,
    queryFn: async () => (await api.get('/investors/pending')).data,
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: async (userId) => (await api.post(`/users/${userId}/reset-password`, {})).data.data,
  });
}

export function useDeactivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, releaseIdentifiers }) =>
      (await api.post(`/users/${id}/deactivate`, { reason, releaseIdentifiers })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useReactivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/users/${id}/reactivate`, {})).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useAssignRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ...payload }) =>
      (await api.post(`/users/${userId}/roles`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useCreateInvitationMutation() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/invitations', payload)).data.data,
  });
}

export function useReviewInvestorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, reason }) =>
      (await api.post(`/investors/${id}/${decision}`, reason ? { reason } : {})).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investors', 'pending'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useAuditLogsQuery(params = {}) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => (await api.get('/audit-logs', { params })).data,
  });
}
