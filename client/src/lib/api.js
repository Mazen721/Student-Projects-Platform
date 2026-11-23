import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api/v1`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;
let sessionExpiredHandler = null;

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post(
        '/auth/refresh',
        {},
        {
          headers: { 'X-Requested-With': 'spp' },
          _skipAuthRefresh: true,
        }
      )
      .then((res) => {
        const { accessToken, user } = res.data?.data || {};
        useAuthStore.getState().setSession({ accessToken, user });
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const { accessToken, activeRoleId } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (activeRoleId) {
    config.headers['X-Role-Context'] = activeRoleId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;
    const errorCode = error?.response?.data?.error?.code;

    if (
      !originalRequest ||
      originalRequest._retry ||
      originalRequest._skipAuthRefresh ||
      status !== 401 ||
      (errorCode && errorCode !== 'TOKEN_EXPIRED' && errorCode !== 'UNAUTHENTICATED')
    ) {
      return Promise.reject(error);
    }

    const requestUrl = String(originalRequest.url || '');
    if (requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const nextToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      useAuthStore.getState().clearSession();
      sessionExpiredHandler?.();
      return Promise.reject(refreshError);
    }
  }
);
