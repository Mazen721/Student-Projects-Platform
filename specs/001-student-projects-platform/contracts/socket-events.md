# Contract: Socket.IO real-time events

Server: Socket.IO 4 on the Express HTTP server, `path: '/socket.io'`, CORS = `CLIENT_URL`
allow-list. See [research.md R-13](../research.md#r-13--real-time-chat-and-notifications-socketio).

## Handshake & auth

```js
io(VITE_API_URL, { path: '/socket.io', auth: { token: accessToken }, transports: ['websocket', 'polling'] })
```
- `io.use` verifies the access JWT (`JWT_SECRET`) and `tokenVersion`; failure → `connect_error`
  with `data.code` ∈ `TOKEN_EXPIRED | UNAUTHENTICATED`. The client refreshes via REST and
  reconnects with the new token.
- On connect the socket auto-joins `user:{userId}`.
- `mustChangePassword` or non-active accounts are refused.
- **Mid-session revocation**: Password change/reset, account deactivation, or role revocation triggers immediate `io.in('user:' + userId).disconnectSockets(true)`. Team removal triggers immediate `io.in('user:' + userId).socketsLeave('channel:' + channelId)` for that project's channels.
- **Mention isolation**: `@mentions` only notify users who belong to `channel.memberIds` (preventing cross-channel leakage).

## Rooms

| Room | Joined by | Authorization |
|---|---|---|
| `user:{userId}` | automatically | self |
| `channel:{channelId}` | `channel:join` | `can(user, 'channel.read', channelScope)` — `team_only` excludes supervisors |

## Client → server

| Event | Payload | Ack |
|---|---|---|
| `channel:join` | `{ channelId }` | `{ ok: true }` or `{ ok: false, error: { code, message } }` (`NOT_FOUND` for unauthorized) |
| `channel:leave` | `{ channelId }` | `{ ok: true }` |
| `message:send` | `sendMessageSchema { channelId, clientId, text?, attachments[CloudinaryUploadResult], replyToId?, mentions[] }` | `{ ok, message }` (persisted; `clientId` echoed for optimistic UI) |
| `message:read` | `{ channelId, upToMessageId }` | `{ ok }` |
| `typing:start` / `typing:stop` | `{ channelId }` | — (throttled server-side 1 per 2 s; not persisted) |

Rate limit: 20 `message:send` per 10 s per socket → `{ ok:false, error:{ code:'RATE_LIMITED' } }`.

## Server → client

| Event | Room | Payload |
|---|---|---|
| `message:new` | `channel:{id}` | message `{ id, channelId, sender{id, name, avatar}, text, attachments[], replyTo?, mentions[], createdAt }` |
| `message:removed` | `channel:{id}` | `{ messageId, channelId }` — client shows `ar.chat.removedByAdmin` |
| `receipt:update` | `channel:{id}` | `{ channelId, userId, upToMessageId, at }` |
| `typing` | `channel:{id}` (except sender) | `{ channelId, userId, name, isTyping }` |
| `notification:new` | `user:{id}` | `{ id, type, titleKey, bodyKey, vars, link, createdAt }` |
| `notification:count` | `user:{id}` | `{ unread }` |
| `channel:unread` | `user:{id}` | `{ channelId, unread }` |
| `project:updated` | `user:{id}` of members/supervisors | `{ projectId, fields[] }` → client invalidates queries |

## Delivery guarantees

- Persist-then-emit: a message is stored before `message:new`; the REST history endpoint is the
  source of truth after reconnect (client refetches messages newer than its last id).
- SC-006 target: emit within < 2 s p95 of `message:send` receipt (single instance, no adapter).
