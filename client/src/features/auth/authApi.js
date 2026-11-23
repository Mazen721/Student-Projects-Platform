import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function usePublicCollegesQuery() {
  return useQuery({
    queryKey: ['public', 'colleges'],
    queryFn: async () => {
      const res = await api.get('/public/colleges');
      return res.data.data || [];
    },
  });
}

export function usePublicDepartmentsQuery(collegeId) {
  return useQuery({
    queryKey: ['public', 'colleges', collegeId, 'departments'],
    enabled: Boolean(collegeId),
    queryFn: async () => {
      const res = await api.get(`/public/colleges/${collegeId}/departments`);
      return res.data.data || [];
    },
  });
}

export function useLoginMutation() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/auth/login', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession({
        accessToken: data.accessToken,
        user: { ...data.user, mustChangePassword: data.mustChangePassword },
      });
    },
  });
}

export function useDemoLoginInfoQuery() {
  return useQuery({
    queryKey: ['auth', 'demo-login'],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/auth/demo-login');
      return res.data.data;
    },
  });
}

export function useDemoLoginMutation() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (account) => {
      const res = await api.post('/auth/demo-login', { account });
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession({
        accessToken: data.accessToken,
        user: { ...data.user, mustChangePassword: data.mustChangePassword },
      });
    },
  });
}

export function useRegisterStudentMutation() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/auth/register/student', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession({ accessToken: data.accessToken, user: data.user });
    },
  });
}

export function useRegisterInvestorMutation() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/auth/register/investor', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession({ accessToken: data.accessToken, user: data.user });
    },
  });
}

export function useRegisterVisitorMutation() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/auth/register/visitor', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession({ accessToken: data.accessToken, user: data.user });
    },
  });
}

export function useChangePasswordMutation() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/auth/change-password', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession({ accessToken: data.accessToken, user: data.user });
    },
  });
}

export function useInvitePreviewQuery(token) {
  return useQuery({
    queryKey: ['invitations', token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const res = await api.get(`/invitations/${token}`);
      return res.data.data;
    },
  });
}

export function useAcceptInviteMutation(token) {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/invitations/${token}/accept`, payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession({ accessToken: data.accessToken, user: data.user });
    },
  });
}

export function useMyProfileQuery() {
  return useQuery({
    queryKey: ['users', 'me', 'profile'],
    queryFn: async () => {
      const res = await api.get('/users/me/profile');
      return res.data.data;
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.patch('/users/me/profile', payload);
      return res.data.data;
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['users', 'me', 'profile'], updatedUser);
      setSession({ accessToken, user: updatedUser });
    },
  });
}
