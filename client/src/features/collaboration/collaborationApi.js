import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMyChannelsQuery(enabled = true) {
  return useQuery({
    queryKey: ['channels', 'mine'],
    enabled,
    queryFn: async () => (await api.get('/channels')).data.data,
  });
}

export function useProjectChannelsQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'channels'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/channels`)).data.data,
  });
}

export function useCreateDirectChannelMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, supervisorId, studentId }) =>
      (
        await api.post(`/projects/${projectId}/channels/direct`, {
          ...(supervisorId ? { supervisorId } : {}),
          ...(studentId ? { studentId } : {}),
        })
      ).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['channels', 'mine'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'channels'] });
    },
  });
}

export function useChannelMessagesQuery(channelId) {
  return useQuery({
    queryKey: ['channels', channelId, 'messages'],
    enabled: Boolean(channelId),
    queryFn: async () => (await api.get(`/channels/${channelId}/messages`)).data.data,
  });
}

export function useSearchChannelMessagesQuery(channelId, q) {
  return useQuery({
    queryKey: ['channels', channelId, 'search', q],
    enabled: Boolean(channelId && q && q.trim().length > 0),
    queryFn: async () =>
      (await api.get(`/channels/${channelId}/search`, { params: { q: q.trim() } })).data.data,
  });
}

export function useSendMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, text, attachments, replyToId, mentions }) =>
      (
        await api.post(`/channels/${channelId}/messages`, {
          ...(text ? { text } : {}),
          ...(attachments?.length ? { attachments } : {}),
          ...(replyToId ? { replyToId } : {}),
          ...(mentions?.length ? { mentions } : {}),
        })
      ).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['channels', vars.channelId, 'messages'] });
      qc.invalidateQueries({ queryKey: ['channels', 'mine'] });
    },
  });
}

export function useMarkChannelReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, upToMessageId }) =>
      api.post(`/channels/${channelId}/read`, upToMessageId ? { upToMessageId } : {}),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['channels', 'mine'] });
      qc.invalidateQueries({ queryKey: ['channels', vars.channelId, 'messages'] });
    },
  });
}

export function useModerateMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, reason, channelId: _c }) =>
      (await api.post(`/messages/${messageId}/remove`, { reason })).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['channels', vars.channelId, 'messages'] });
    },
  });
}

export function useCommentsQuery(targetType, targetId) {
  return useQuery({
    queryKey: ['comments', targetType, targetId],
    enabled: Boolean(targetType && targetId),
    queryFn: async () =>
      (await api.get('/comments', { params: { targetType, targetId } })).data.data,
  });
}

export function useCreateCommentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/comments', payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', vars.targetType, vars.targetId] });
    },
  });
}

export function useModerateCommentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, reason, targetType: _t, targetId: _i }) =>
      (await api.post(`/comments/${commentId}/remove`, { reason })).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', vars.targetType, vars.targetId] });
    },
  });
}

export function useAnnouncementsQuery(params = {}) {
  return useQuery({
    queryKey: ['announcements', params],
    queryFn: async () => (await api.get('/announcements', { params })).data,
  });
}

export function useCreateAnnouncementMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/announcements', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useNotificationsQuery(params = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => (await api.get('/notifications', { params })).data,
  });
}

export function useMarkNotificationsReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => api.post('/notifications/read', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useProjectAlbumsQuery(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'albums'],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/albums`)).data.data,
  });
}

export function useCreateAlbumMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, title }) =>
      (await api.post(`/projects/${projectId}/albums`, { title })).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'albums'] });
    },
  });
}

export function useAddMediaItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ albumId, projectId: _p, ...payload }) =>
      (await api.post(`/albums/${albumId}/items`, payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'albums'] });
    },
  });
}

export function useUpdateMediaItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, projectId: _p, ...payload }) =>
      (await api.patch(`/media-items/${itemId}`, payload)).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'albums'] });
    },
  });
}

export function useRemoveMediaItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, reason, projectId: _p }) =>
      (await api.post(`/media-items/${itemId}/remove`, reason ? { reason } : {})).data.data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'albums'] });
    },
  });
}
