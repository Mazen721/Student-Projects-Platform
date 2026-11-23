import { Server } from 'socket.io';
import { USER_STATUSES } from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { OBJECT_ID_RE } from '@spp/shared/schemas';
import { corsOptions } from '../config/cors.js';
import User from '../modules/auth/user.model.js';
import { verifyAccessToken } from '../core/auth/tokens.js';
import { can } from '../core/authz/can.js';
import { resolveResourceScope } from '../core/authz/scopeResolvers.js';
import { setNotificationSocket } from '../core/notifications/notify.service.js';
import { registerChatHandlers } from './chat.handlers.js';

const customHandlerRegistrars = [registerChatHandlers];
let activeIo = null;

export function registerSocketHandlers(registrar) {
  if (!customHandlerRegistrars.includes(registrar)) {
    customHandlerRegistrars.push(registrar);
  }
}

export function getSocketServer() {
  return activeIo;
}

export function emitToChannel(channelId, event, payload) {
  if (!activeIo || !channelId) return;
  activeIo.to(`channel:${String(channelId)}`).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  if (!activeIo || !userId) return;
  activeIo.to(`user:${String(userId)}`).emit(event, payload);
}

function makeSocketError(code) {
  const err = new Error(t(`errors.${code}`));
  err.data = { code };
  return err;
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: corsOptions,
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(makeSocketError('UNAUTHENTICATED'));
      }
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub)
        .select('name status accountType collegeId departmentId roles tokenVersion mustChangePassword profile.avatar')
        .lean();

      if (!user || user.tokenVersion !== payload.tv) {
        return next(makeSocketError('UNAUTHENTICATED'));
      }
      if (user.status !== USER_STATUSES.ACTIVE || user.mustChangePassword) {
        return next(makeSocketError('UNAUTHENTICATED'));
      }

      socket.data.user = { ...user, id: String(user._id) };
      return next();
    } catch (err) {
      const code = err?.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED';
      return next(makeSocketError(code));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);

    socket.on('channel:join', async ({ channelId } = {}, ack) => {
      try {
        if (!OBJECT_ID_RE.test(String(channelId || ''))) {
          ack?.({ ok: false, error: { code: 'NOT_FOUND', message: t('errors.NOT_FOUND') } });
          return;
        }
        const { scope } = await resolveResourceScope('channel', { params: { id: channelId }, user });
        if (!scope || !can(user, 'channel.read', scope)) {
          ack?.({ ok: false, error: { code: 'NOT_FOUND', message: t('errors.NOT_FOUND') } });
          return;
        }
        await socket.join(`channel:${channelId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: { code: 'NOT_FOUND', message: t('errors.NOT_FOUND') } });
      }
    });

    socket.on('channel:leave', async ({ channelId } = {}, ack) => {
      if (channelId) {
        await socket.leave(`channel:${channelId}`);
      }
      ack?.({ ok: true });
    });

    for (const register of customHandlerRegistrars) {
      register(io, socket);
    }
  });

  activeIo = io;
  setNotificationSocket(io);
  return io;
}

export function disconnectUserSockets(userIdOrIo, maybeUserId) {
  const io = maybeUserId ? userIdOrIo : activeIo;
  const userId = maybeUserId || userIdOrIo;
  if (!io || !userId) return;
  io.in(`user:${String(userId)}`).disconnectSockets(true);
}

export function evictUserFromChannel(userIdOrIo, channelIdOrUserId, maybeChannelId) {
  const io = maybeChannelId ? userIdOrIo : activeIo;
  const userId = maybeChannelId ? channelIdOrUserId : userIdOrIo;
  const channelId = maybeChannelId || channelIdOrUserId;
  if (!io || !userId || !channelId) return;
  io.in(`user:${String(userId)}`).socketsLeave(`channel:${String(channelId)}`);
}
