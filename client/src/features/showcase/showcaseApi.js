import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePublicHomeQuery() {
  return useQuery({
    queryKey: ['public', 'home'],
    queryFn: async () => {
      const res = await api.get('/public/home');
      return res.data.data;
    },
  });
}

export function usePublicProjectsQuery(params = {}) {
  return useQuery({
    queryKey: ['public', 'projects', params],
    queryFn: async () => {
      const res = await api.get('/public/projects', { params });
      return res.data;
    },
  });
}

export function usePublicCollegeShowcaseQuery(collegeId, params = {}) {
  return useQuery({
    queryKey: ['public', 'collegeShowcase', collegeId, params],
    enabled: Boolean(collegeId),
    queryFn: async () => {
      const res = await api.get(`/public/colleges/${collegeId}/showcase`, { params });
      return res.data;
    },
  });
}

export function usePublicProjectDetailQuery(slug) {
  return useQuery({
    queryKey: ['public', 'project', slug],
    enabled: Boolean(slug),
    retry: false,
    queryFn: async () => {
      const res = await api.get(`/public/projects/${slug}`);
      return res.data.data;
    },
  });
}

export function usePublicCommentsQuery(slug, params = {}) {
  return useQuery({
    queryKey: ['public', 'comments', slug, params],
    enabled: Boolean(slug),
    queryFn: async () => {
      const res = await api.get(`/public/projects/${slug}/comments`, { params });
      return res.data;
    },
  });
}

export function usePublicCompetitionsQuery() {
  return useQuery({
    queryKey: ['public', 'competitions'],
    queryFn: async () => {
      const res = await api.get('/public/competitions');
      return res.data.data || [];
    },
  });
}

export function useTeamShowcaseQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'showcase'],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/showcase`);
      return res.data.data;
    },
  });
}

export function useUpdateTeamShowcaseMutation(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/projects/${projectId}/showcase`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'showcase'] });
      qc.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

export function useTransitionShowcaseMutation(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/projects/${projectId}/showcase/transitions`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'showcase'] });
      qc.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

export function useVoteMutation(projectId, slug) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ hasVoted }) => {
      if (hasVoted) {
        await api.delete(`/projects/${projectId}/vote`);
        return { hasVoted: false };
      }
      const res = await api.post(`/projects/${projectId}/vote`, {});
      return { hasVoted: true, ...res.data.data };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public', 'project', slug] });
      qc.invalidateQueries({ queryKey: ['public', 'home'] });
    },
  });
}

export function useCompetitionVoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ competitionId, projectId, withdraw = false }) => {
      if (withdraw) {
        await api.delete(`/competitions/${competitionId}/projects/${projectId}/vote`);
        return null;
      }
      const res = await api.post(`/competitions/${competitionId}/projects/${projectId}/vote`, {});
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public', 'competitions'] });
    },
  });
}

export function useCreateCompetitionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/competitions', payload);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public', 'competitions'] });
    },
  });
}

export function useFlaggedVotesQuery(params = {}) {
  return useQuery({
    queryKey: ['votes', 'flagged', params],
    queryFn: async () => {
      const res = await api.get('/votes/flagged', { params });
      return res.data;
    },
  });
}

export function useReviewFlaggedVoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, reason }) => {
      const res = await api.post(`/votes/${id}/review`, { decision, reason });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['votes', 'flagged'] });
      qc.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

export function useInvestorProjectActionMutation(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, remove = false }) => {
      if (remove) {
        await api.delete(`/projects/${projectId}/${action}`);
        return null;
      }
      const res = await api.post(`/projects/${projectId}/${action}`, {});
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'follows'] });
      qc.invalidateQueries({ queryKey: ['me', 'bookmarks'] });
    },
  });
}

export function useCreateContactRequestMutation(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/projects/${projectId}/contact-requests`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'contactRequests'] });
    },
  });
}

export function useProjectContactRequestsQuery(projectId, enabled = false) {
  return useQuery({
    queryKey: ['projects', projectId, 'contactRequests'],
    enabled: Boolean(projectId) && enabled,
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/contact-requests`);
      return res.data.data || [];
    },
  });
}

export function useDecideContactRequestMutation(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, reply }) => {
      const res = await api.post(`/contact-requests/${id}/decide`, { decision, reply });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'contactRequests'] });
    },
  });
}

export function useMyFollowsQuery() {
  return useQuery({
    queryKey: ['me', 'follows'],
    queryFn: async () => {
      const res = await api.get('/me/follows');
      return res.data.data || [];
    },
  });
}

export function useMyBookmarksQuery() {
  return useQuery({
    queryKey: ['me', 'bookmarks'],
    queryFn: async () => {
      const res = await api.get('/me/bookmarks');
      return res.data.data || [];
    },
  });
}

export function useMyContactRequestsQuery() {
  return useQuery({
    queryKey: ['me', 'contactRequests'],
    queryFn: async () => {
      const res = await api.get('/me/contact-requests');
      return res.data.data || [];
    },
  });
}

export function useChallengesQuery(params = {}) {
  return useQuery({
    queryKey: ['challenges', params],
    queryFn: async () => {
      const res = await api.get('/challenges', { params });
      return res.data.data || [];
    },
  });
}

export function useCreateChallengeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/challenges', payload);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}

export function useRemoveChallengeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.post(`/challenges/${id}/remove`, { reason });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}

export function useCreatePublicCommentMutation(projectId, slug) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/projects/${projectId}/public-comments`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public', 'comments', slug] });
    },
  });
}

export function useReportPublicCommentMutation(slug) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.post(`/public-comments/${id}/report`, { reason });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public', 'comments', slug] });
    },
  });
}

export function useModeratePublicCommentMutation(slug) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, reason }) => {
      const res = await api.post(`/public-comments/${id}/moderate`, { action, reason });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public', 'comments', slug] });
    },
  });
}
