import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProjectsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: ['projects', params],
    enabled: options.enabled ?? true,
    queryFn: async () => (await api.get('/projects', { params })).data,
  });
}

export function useProjectQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}`)).data.data,
  });
}

export function useSimilarTitlesQuery(title, excludeId) {
  const trimmed = String(title || '').trim();
  return useQuery({
    queryKey: ['projects', 'similar-titles', trimmed, excludeId || null],
    enabled: trimmed.length >= 4,
    queryFn: async () =>
      (
        await api.get('/projects/similar-titles', {
          params: { title: trimmed, ...(excludeId ? { excludeId } : {}) },
        })
      ).data.data,
  });
}

export function useProjectHistoryQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'history'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/history`)).data.data,
  });
}

export function useProposalVersionQuery(projectId, version) {
  return useQuery({
    queryKey: ['projects', projectId, 'versions', version],
    enabled: Boolean(projectId && version),
    queryFn: async () => (await api.get(`/projects/${projectId}/versions/${version}`)).data.data,
  });
}

export function useCreateProposalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/projects', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProposalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.patch(`/projects/${id}`, payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.id] });
    },
  });
}

export function useTransitionProposalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, event, comment }) =>
      (await api.post(`/projects/${id}/transitions`, { event, ...(comment ? { comment } : {}) })).data
        .data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.id] });
      qc.invalidateQueries({ queryKey: ['projects', vars.id, 'history'] });
    },
  });
}

export function useSearchTeammatesQuery(q, collegeId, enabled = true) {
  const trimmed = String(q || '').trim();
  return useQuery({
    queryKey: ['users', 'search-team', trimmed, collegeId || null],
    enabled: enabled && trimmed.length >= 2,
    queryFn: async () =>
      (
        await api.get('/users/search', {
          params: { q: trimmed, ...(collegeId ? { collegeId } : {}) },
        })
      ).data.data,
  });
}

export function useMyTeamInvitationsQuery(enabled = true) {
  return useQuery({
    queryKey: ['team-invitations', 'me'],
    enabled,
    queryFn: async () => (await api.get('/me/team-invitations')).data.data,
  });
}

export function useInviteTeammateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...payload }) =>
      (await api.post(`/projects/${projectId}/team/invitations`, payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['projects', vars.projectId] }),
  });
}

export function useRespondTeamInvitationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, token }) =>
      (
        await api.post(
          `/team-invitations/${id}/${decision}`,
          token ? { token } : {}
        )
      ).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-invitations'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useRemoveTeamMemberMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, userId, reason }) =>
      (
        await api.delete(`/projects/${projectId}/team/members/${userId}`, {
          data: reason ? { reason } : {},
        })
      ).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['projects', vars.projectId] }),
  });
}

export function useLeaveTeamMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId) => (await api.post(`/projects/${projectId}/team/leave`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useRequestLeadershipTransferMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, toUserId }) =>
      (await api.post(`/projects/${projectId}/leadership-transfer`, { toUserId })).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['projects', vars.projectId] }),
  });
}

export function useSupervisorsLoadQuery(params = {}) {
  return useQuery({
    queryKey: ['supervisors', 'load', params],
    enabled: Boolean(params.academicYearId),
    queryFn: async () => (await api.get('/supervisors/load', { params })).data.data,
  });
}

export function useAssignSupervisionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...payload }) =>
      (await api.put(`/projects/${projectId}/supervision`, payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['supervisors', 'load'] });
    },
  });
}

export function useIdeasQuery(params = {}) {
  return useQuery({
    queryKey: ['ideas', params],
    queryFn: async () => (await api.get('/ideas', { params })).data,
  });
}

export function useCreateIdeaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/ideas', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  });
}

export function useRemoveIdeaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) =>
      (await api.post(`/ideas/${id}/remove`, { reason })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  });
}

export function useRequestAdoptionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }) =>
      (await api.post(`/ideas/${id}/adoption-requests`, projectId ? { projectId } : {})).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  });
}

export function useMyAdoptionRequestsQuery(enabled = true) {
  return useQuery({
    queryKey: ['adoption-requests', 'me'],
    enabled,
    queryFn: async () => (await api.get('/me/adoption-requests')).data.data,
  });
}

export function useDecideAdoptionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }) =>
      (await api.post(`/adoption-requests/${id}/${decision}`)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adoption-requests'] });
      qc.invalidateQueries({ queryKey: ['ideas'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
