import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePhaseTemplatesQuery(collegeId) {
  return useQuery({
    queryKey: ['phase-templates', collegeId],
    enabled: Boolean(collegeId),
    queryFn: async () => (await api.get(`/colleges/${collegeId}/phase-templates`)).data.data,
  });
}

export function useCreatePhaseTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collegeId, ...payload }) =>
      (await api.post(`/colleges/${collegeId}/phase-templates`, payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['phase-templates', vars.collegeId] }),
  });
}

export function useUpdatePhaseTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, collegeId: _c, ...payload }) =>
      (await api.patch(`/phase-templates/${id}`, payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['phase-templates', vars.collegeId] }),
  });
}

export function useProjectPhasesQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'phases'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/phases`)).data.data,
  });
}

export function useAdjustPhaseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, phaseId, dueDate }) =>
      (await api.patch(`/projects/${projectId}/phases/${phaseId}`, { dueDate })).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'phases'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'timeline'] });
    },
  });
}

export function useCompletePhaseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, phaseId }) =>
      (await api.post(`/projects/${projectId}/phases/${phaseId}/complete`)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'phases'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'timeline'] });
    },
  });
}

export function useReopenPhaseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, phaseId, reason }) =>
      (await api.post(`/projects/${projectId}/phases/${phaseId}/reopen`, { reason })).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'phases'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'timeline'] });
    },
  });
}

export function useAddMilestoneMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, phaseId, title, dueDate }) =>
      (await api.post(`/projects/${projectId}/phases/${phaseId}/milestones`, { title, dueDate }))
        .data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'phases'] });
    },
  });
}

export function useDeliverableSubmissionsQuery(projectId, deliverableId) {
  return useQuery({
    queryKey: ['projects', projectId, 'deliverables', deliverableId, 'submissions'],
    enabled: Boolean(projectId && deliverableId),
    queryFn: async () =>
      (await api.get(`/projects/${projectId}/deliverables/${deliverableId}/submissions`)).data.data,
  });
}

export function useCreateSubmissionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, deliverableId, files, links, note }) =>
      (
        await api.post(`/projects/${projectId}/deliverables/${deliverableId}/submissions`, {
          files,
          links,
          ...(note ? { note } : {}),
        })
      ).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'phases'] });
      qc.invalidateQueries({
        queryKey: ['projects', vars.projectId, 'deliverables', vars.deliverableId, 'submissions'],
      });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'timeline'] });
    },
  });
}

export function useReviewSubmissionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ submissionId, projectId: _p, deliverableId: _d, decision, comment }) =>
      (
        await api.post(`/submissions/${submissionId}/review`, {
          decision,
          ...(comment ? { comment } : {}),
        })
      ).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'phases'] });
      qc.invalidateQueries({
        queryKey: ['projects', vars.projectId, 'deliverables', vars.deliverableId, 'submissions'],
      });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'timeline'] });
    },
  });
}

export function useUpdateStatusFlagMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, statusFlag }) =>
      (await api.patch(`/projects/${projectId}/status-flag`, { statusFlag })).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
    },
  });
}

export function useTasksQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/tasks`)).data.data,
  });
}

export function useCreateTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...payload }) =>
      (await api.post(`/projects/${projectId}/tasks`, payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'tasks'] }),
  });
}

export function useUpdateTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, projectId: _p, ...payload }) =>
      (await api.patch(`/tasks/${taskId}`, payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'tasks'] }),
  });
}

export function useDeleteTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, projectId: _p }) => api.delete(`/tasks/${taskId}`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'tasks'] }),
  });
}

export function useBomQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'bom'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/bom`)).data.data,
  });
}

export function useCreateBomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...payload }) =>
      (await api.post(`/projects/${projectId}/bom`, payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'bom'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
    },
  });
}

export function useUpdateBomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, projectId: _p, ...payload }) =>
      (await api.patch(`/bom/${itemId}`, payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'bom'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
    },
  });
}

export function useDeleteBomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, projectId: _p }) => (await api.delete(`/bom/${itemId}`)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'bom'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
    },
  });
}

export function useToolsQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'tools'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/tools`)).data.data,
  });
}

export function useCreateToolMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...payload }) =>
      (await api.post(`/projects/${projectId}/tools`, payload)).data.data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'tools'] }),
  });
}

export function useDeleteToolMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ toolId, projectId: _p }) => api.delete(`/tools/${toolId}`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'tools'] }),
  });
}

export function useMeetingsQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'meetings'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/meetings`)).data.data,
  });
}

export function useCreateMeetingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...payload }) =>
      (await api.post(`/projects/${projectId}/meetings`, payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'meetings'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'timeline'] });
    },
  });
}

export function useConvertActionItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, index, projectId: _p }) =>
      (await api.post(`/meetings/${meetingId}/action-items/${index}/to-task`)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'meetings'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'tasks'] });
    },
  });
}

export function useProjectTimelineQuery(projectId, params = {}) {
  return useQuery({
    queryKey: ['projects', projectId, 'timeline', params],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/timeline`, { params })).data,
  });
}
