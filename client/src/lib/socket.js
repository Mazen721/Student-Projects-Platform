import { io } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { refreshAccessToken } from './api';

let socketInstance = null;

export function getSocket() {
  return socketInstance;
}

export function connectSocket() {
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;

  if (socketInstance) {
    socketInstance.auth = { token };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
    return socketInstance;
  }

  const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  socketInstance = io(baseUrl || undefined, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socketInstance.on('connect', () => {
    useUiStore.getState().setSocketReconnecting(false);
  });

  socketInstance.on('disconnect', () => {
    useUiStore.getState().setSocketReconnecting(true);
  });

  socketInstance.on('connect_error', async (err) => {
    if (err?.data?.code === 'TOKEN_EXPIRED') {
      try {
        const nextToken = await refreshAccessToken();
        if (socketInstance && nextToken) {
          socketInstance.auth = { token: nextToken };
          socketInstance.connect();
        }
      } catch {
        disconnectSocket();
      }
    }
  });

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  useUiStore.getState().setSocketReconnecting(false);
}
