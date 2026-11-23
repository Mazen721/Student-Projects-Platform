# Contract: collaboration module

Schemas: `shared/src/schemas/collaboration.js`. Real-time counterpart: [socket-events.md](./socket-events.md).

## Channels & messages (REST for history/search; sending happens over Socket.IO, REST fallback provided)

| Method | Path | authorize | Body / Query | Success | Notes |
|---|---|---|---|---|---|
| GET | `/channels` | `authorize('channel.list','self')` | — | channels the caller belongs to with `unreadCount`, `lastMessage` | |
| GET | `/projects/:id/channels` | `authorize('channel.list','project')` | — | `project_group`, `team_only` (team only), `direct` (own) | supervisors never receive `team_only` (US4-2) |
| POST | `/projects/:id/channels/direct` | `authorize('channel.createDirect','project')` | `{supervisorId}` or `{studentId}` | 201/200 existing | student ↔ own supervisor only |
| GET | `/channels/:channelId/messages` | `authorize('channel.read','channel')` | `{before?: messageId, limit ≤ 50}` | cursor page (newest first) | removed messages return tombstone key `chat.removedByAdmin` |
| POST | `/channels/:channelId/messages` | `authorize('channel.write','channel')` | `sendMessageSchema {text?, attachments[CloudinaryUploadResult], replyToId?, mentions[]}` | 201 message (also broadcast) | REST fallback for socket send |
| POST | `/channels/:channelId/read` | `authorize('channel.read','channel')` | `{upToMessageId}` | 204 | updates `lastReadAt` + receipts |
| GET | `/channels/:channelId/search` | `authorize('channel.read','channel')` | `{q, page, limit}` | matches within that channel only (FR-071; `team_only` strictly inaccessible to supervisors) | Atlas `messages_search` or normalized fallback |
| POST | `/messages/:messageId/remove` | `authorize('content.moderate','message')` | `{reason}` | 200 (audited; US4-5) | emits `message:removed` |

## Comments (deliverables / tasks)

| Method | Path | authorize | Body | Success |
|---|---|---|---|---|
| GET | `/comments?targetType=&targetId=` | `authorize('comment.read', targetType)` | page | thread |
| POST | `/comments` | `authorize('comment.create', targetType)` | `commentSchema {targetType, targetId, text, parentId?, mentions[]}` | 201 |
| POST | `/comments/:id/remove` | `authorize('content.moderate','comment')` | `{reason}` | 200 (audited) |

## Announcements & notifications

| Method | Path | authorize | Body / Query | Success |
|---|---|---|---|---|
| POST | `/announcements` | `authorize('announcement.create','scope')` | `announcementSchema {scopeType: college|department|supervision|university, scopeId?, title, body}` | 201 `{audienceCount}` (US4-4) |
| GET | `/announcements` | `authorize('announcement.list','self')` | page | announcements targeting caller |
| GET | `/notifications` | `authorize('notification.list','self')` | `{unread?: bool, page, limit}` | paginated + `unreadCount` |
| POST | `/notifications/read` | `authorize('notification.update','self')` | `{ids[]}` or `{all:true}` | 204 (FR-075) |

## Media gallery

| Method | Path | authorize | Body | Success |
|---|---|---|---|---|
| GET | `/projects/:id/albums` | `authorize('media.read','project')` | — | albums + items (signed URLs for private) |
| POST | `/projects/:id/albums` | `authorize('media.write','project')` | `{title}` | 201 |
| POST | `/albums/:albumId/items` | `authorize('media.write','album')` | `mediaItemSchema {kind: photo|video_link, upload?: CloudinaryUploadResult, link?: LinkRef, caption, visibility}` | 201 (default `private`) |
| PATCH | `/media-items/:itemId` | `authorize('media.write','mediaItem')` | `{caption?, visibility?}` | updated |
| POST | `/media-items/:itemId/remove` | `authorize('content.moderate','mediaItem')` or `media.write` (team, own) | `{reason?}` | 200 (admin removal audited) |
