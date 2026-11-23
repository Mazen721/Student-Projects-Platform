import { t } from '@spp/shared/locales/ar';
import { OBJECT_ID_RE, sendMessageSchema } from '@spp/shared/schemas';
import { can } from '../core/authz/can.js';
import { resolveResourceScope } from '../core/authz/scopeResolvers.js';
import {
  markChannelRead,
  sendMessage,
} from '../modules/collaboration/collaboration.service.js';

const RATE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 20;
const TYPING_THROTTLE_MS = 2_000;

function isMessageRateLimited(timestamps, now) {
  while (timestamps.length > 0 && now - timestamps[0] >= RATE_WINDOW_MS) {
    timestamps.shift();
  }
  if (timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    return true;
  }
  timestamps.push(now);
  return false;
}

async function authorizeChannelAction(user, channelId, action) {
  if (!OBJECT_ID_RE.test(String(channelId || ''))) {
    return false;
  }
  const { scope } = await resolveResourceScope('channel', { params: { id: channelId }, user });
  return Boolean(scope && can(user, action, scope));
}

function registerTypingHandler(socket, user, eventName, isTyping, lastTypingAt) {
  socket.on(eventName, ({ channelId } = {}) => {
    const room = `channel:${String(channelId || '')}`;
    if (!socket.rooms.has(room)) return;
    const key = `${channelId}:${eventName}`;
    const now = Date.now();
    if (now - (lastTypingAt.get(key) || 0) < TYPING_THROTTLE_MS) return;
    lastTypingAt.set(key, now);
    socket.to(room).emit('typing', {
      channelId: String(channelId),
      userId: user.id,
      name: user.name,
      isTyping,
    });
  });
}

export function registerChatHandlers(_io, socket) {
  const user = socket.data.user;
  const sendTimestamps = [];
  const lastTypingAt = new Map();

  socket.on('message:send', async (payload = {}, ack) => {
    try {
      if (isMessageRateLimited(sendTimestamps, Date.now())) {
        ack?.({ ok: false, error: { code: 'RATE_LIMITED', message: t('errors.RATE_LIMITED') } });
        return;
      }

      const { channelId, clientId, text, attachments, replyToId, mentions } = payload;
      const allowed = await authorizeChannelAction(user, channelId, 'channel.write');
      if (!allowed) {
        ack?.({ ok: false, error: { code: 'NOT_FOUND', message: t('errors.NOT_FOUND') } });
        return;
      }

      const parsed = sendMessageSchema.safeParse({ text, attachments, replyToId, mentions });
      if (!parsed.success) {
        ack?.({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: t('errors.VALIDATION_ERROR') },
        });
        return;
      }

      const message = await sendMessage(channelId, parsed.data, { actor: user });
      ack?.({ ok: true, clientId, message });
    } catch (err) {
      const code = err?.code || 'INTERNAL_ERROR';
      ack?.({
        ok: false,
        error: { code, message: err?.message || t(`errors.${code}`) },
      });
    }
  });

  socket.on('message:read', async ({ channelId, upToMessageId } = {}, ack) => {
    try {
      const allowed = await authorizeChannelAction(user, channelId, 'channel.read');
      if (!allowed) {
        ack?.({ ok: false, error: { code: 'NOT_FOUND', message: t('errors.NOT_FOUND') } });
        return;
      }
      if (upToMessageId && !OBJECT_ID_RE.test(String(upToMessageId))) {
        ack?.({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: t('errors.VALIDATION_ERROR') },
        });
        return;
      }
      await markChannelRead(channelId, upToMessageId, { actor: user });
      ack?.({ ok: true });
    } catch (err) {
      const code = err?.code || 'INTERNAL_ERROR';
      ack?.({
        ok: false,
        error: { code, message: err?.message || t(`errors.${code}`) },
      });
    }
  });

  registerTypingHandler(socket, user, 'typing:start', true, lastTypingAt);
  registerTypingHandler(socket, user, 'typing:stop', false, lastTypingAt);
}
