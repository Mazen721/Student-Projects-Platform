import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRubricsQuery(collegeId, academicYearId) {
  return useQuery({
    queryKey: ['rubrics', collegeId, academicYearId || 'all'],
    enabled: Boolean(collegeId),
    queryFn: async () =>
      (
        await api.get(`/colleges/${collegeId}/rubrics`, {
          params: academicYearId ? { academicYearId } : undefined,
        })
      ).data.data,
  });
}

export function useCreateRubricMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collegeId, ...payload }) =>
      (await api.post(`/colleges/${collegeId}/rubrics`, payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['rubrics', vars.collegeId] }),
  });
}

export function useUpdateRubricMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, collegeId: _c, ...payload }) =>
      (await api.patch(`/rubrics/${id}`, payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['rubrics', vars.collegeId] }),
  });
}

export function useDefenseEligibilityQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'defense', 'eligibility'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/defense/eligibility`)).data.data,
  });
}

export function useSignOffDefenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId) =>
      (await api.post(`/projects/${projectId}/defense/sign-off`)).data.data,
    onSuccess: (_d, projectId) => {
      qc.invalidateQueries({ queryKey: ['projects', projectId] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'defense', 'eligibility'] });
    },
  });
}

export function useAvailableExaminersQuery(projectId, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'defense', 'examiners'],
    enabled: Boolean(projectId && enabled),
    queryFn: async () => (await api.get(`/projects/${projectId}/defense/examiners`)).data.data,
  });
}

export function useScheduleDefenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...payload }) =>
      (await api.post(`/projects/${projectId}/defense`, payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'defense', 'eligibility'] });
      qc.invalidateQueries({ queryKey: ['defenses'] });
    },
  });
}

export function useDefensesQuery(params = {}, enabled = true) {
  return useQuery({
    queryKey: ['defenses', params],
    enabled,
    queryFn: async () => (await api.get('/defenses', { params })).data,
  });
}

export function useDefenseQuery(defenseId) {
  return useQuery({
    queryKey: ['defenses', defenseId],
    enabled: Boolean(defenseId),
    queryFn: async () => (await api.get(`/defenses/${defenseId}`)).data.data,
  });
}

export function useInviteExternalExaminerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/invitations/external-examiner', payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['defenses', vars.defenseId] }),
  });
}

export function useMyScoresheetQuery(defenseId) {
  return useQuery({
    queryKey: ['defenses', defenseId, 'my-scoresheet'],
    enabled: Boolean(defenseId),
    queryFn: async () => (await api.get(`/defenses/${defenseId}/my-scoresheet`)).data.data,
  });
}

export function useSubmitMyScoresMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ defenseId, ...payload }) =>
      (await api.put(`/defenses/${defenseId}/my-scores`, payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['defenses', vars.defenseId] });
      qc.invalidateQueries({ queryKey: ['defenses', vars.defenseId, 'my-scoresheet'] });
      qc.invalidateQueries({ queryKey: ['defenses', vars.defenseId, 'scores'] });
    },
  });
}

export function useAllDefenseScoresQuery(defenseId, enabled = true) {
  return useQuery({
    queryKey: ['defenses', defenseId, 'scores'],
    enabled: Boolean(defenseId && enabled),
    retry: false,
    queryFn: async () => (await api.get(`/defenses/${defenseId}/scores`)).data.data,
  });
}

export function useTransitionDefenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ defenseId, event, note }) =>
      (await api.post(`/defenses/${defenseId}/transitions`, { event, ...(note ? { note } : {}) }))
        .data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['defenses'] });
      qc.invalidateQueries({ queryKey: ['defenses', vars.defenseId] });
      qc.invalidateQueries({ queryKey: ['defenses', vars.defenseId, 'my-scoresheet'] });
      qc.invalidateQueries({ queryKey: ['defenses', vars.defenseId, 'scores'] });
    },
  });
}

export function useRecordMinutesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ defenseId, ...payload }) =>
      (await api.put(`/defenses/${defenseId}/minutes`, payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['defenses', vars.defenseId] }),
  });
}

export function useConfirmModificationsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (defenseId) =>
      (await api.post(`/defenses/${defenseId}/modifications/confirm`)).data.data,
    onSuccess: (_d, defenseId) => {
      qc.invalidateQueries({ queryKey: ['defenses', defenseId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useProjectGradesQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'grades'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/grades`)).data.data,
  });
}

export function useRequestReevaluationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, reason }) =>
      (await api.post(`/projects/${projectId}/reevaluations`, { reason })).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'grades'] });
      qc.invalidateQueries({ queryKey: ['reevaluations'] });
    },
  });
}

export function useReevaluationsQuery(params = {}) {
  return useQuery({
    queryKey: ['reevaluations', params],
    queryFn: async () => (await api.get('/reevaluations', { params })).data,
  });
}

export function useDecideReevaluationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) =>
      (await api.post(`/reevaluations/${id}/decide`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reevaluations'] });
      qc.invalidateQueries({ queryKey: ['defenses'] });
    },
  });
}

export async function downloadCertificateFile(projectId, studentId, fallbackFilename) {
  const res = await api.get(`/projects/${projectId}/grades/${studentId}/certificate.pdf`, {
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(res.data);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fallbackFilename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}
