import { Router } from 'express';
import { authorize } from '../../core/authz/authorize.js';
import { validate } from '../../core/validation/validate.js';
import {
  registerOnProjectApprovedHook,
  registerOnProjectMembersChangedHook,
} from '../projects/index.js';
import * as ctrl from './collaboration.controller.js';
import {
  provisionProjectChannels,
  syncProjectChannelMembers,
} from './collaboration.service.js';
import {
  albumParamSchema,
  announcementSchema,
  channelParamSchema,
  commentSchema,
  createAlbumSchema,
  createDirectChannelSchema,
  idParamSchema,
  listCommentsQuerySchema,
  listMessagesQuerySchema,
  listNotificationsQuerySchema,
  markChannelReadBodySchema,
  markNotificationsReadSchema,
  mediaItemParamSchema,
  mediaItemSchema,
  messageParamSchema,
  optionalReasonBodySchema,
  paginationQuerySchema,
  reasonBodySchema,
  searchMessagesQuerySchema,
  sendMessageSchema,
  updateMediaItemSchema,
} from './collaboration.validation.js';

export function createCollaborationRouter(limiters) {
  const router = Router();
  const { writeLimiter } = limiters;

  registerOnProjectApprovedHook(provisionProjectChannels);
  registerOnProjectMembersChangedHook(syncProjectChannelMembers);

  router.get(
    '/channels',
    authorize('channel.list', 'self'),
    ctrl.listMyChannelsHandler
  );
  router.get(
    '/projects/:id/channels',
    authorize('channel.list', 'project'),
    validate({ params: idParamSchema }),
    ctrl.listProjectChannelsHandler
  );
  router.post(
    '/projects/:id/channels/direct',
    authorize('channel.createDirect', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: createDirectChannelSchema }),
    ctrl.createDirectChannelHandler
  );
  router.get(
    '/channels/:channelId/messages',
    authorize('channel.read', 'channel'),
    validate({ params: channelParamSchema, query: listMessagesQuerySchema }),
    ctrl.listMessagesHandler
  );
  router.post(
    '/channels/:channelId/messages',
    authorize('channel.write', 'channel'),
    writeLimiter,
    validate({ params: channelParamSchema, body: sendMessageSchema }),
    ctrl.sendMessageHandler
  );
  router.post(
    '/channels/:channelId/read',
    authorize('channel.read', 'channel'),
    validate({ params: channelParamSchema, body: markChannelReadBodySchema }),
    ctrl.markChannelReadHandler
  );
  router.get(
    '/channels/:channelId/search',
    authorize('channel.read', 'channel'),
    validate({ params: channelParamSchema, query: searchMessagesQuerySchema }),
    ctrl.searchMessagesHandler
  );
  router.post(
    '/messages/:messageId/remove',
    authorize('content.moderate', 'message'),
    writeLimiter,
    validate({ params: messageParamSchema, body: reasonBodySchema }),
    ctrl.moderateMessageHandler
  );

  router.get(
    '/comments',
    authorize('comment.read', 'commentTarget'),
    validate({ query: listCommentsQuerySchema }),
    ctrl.listCommentsHandler
  );
  router.post(
    '/comments',
    authorize('comment.create', 'commentTarget'),
    writeLimiter,
    validate({ body: commentSchema }),
    ctrl.createCommentHandler
  );
  router.post(
    '/comments/:id/remove',
    authorize('content.moderate', 'comment'),
    writeLimiter,
    validate({ params: idParamSchema, body: reasonBodySchema }),
    ctrl.moderateCommentHandler
  );

  router.post(
    '/announcements',
    authorize('announcement.create', 'scope'),
    writeLimiter,
    validate({ body: announcementSchema }),
    ctrl.createAnnouncementHandler
  );
  router.get(
    '/announcements',
    authorize('announcement.list', 'self'),
    validate({ query: paginationQuerySchema }),
    ctrl.listAnnouncementsHandler
  );

  router.get(
    '/notifications',
    authorize('notification.list', 'self'),
    validate({ query: listNotificationsQuerySchema }),
    ctrl.listNotificationsHandler
  );
  router.post(
    '/notifications/read',
    authorize('notification.update', 'self'),
    validate({ body: markNotificationsReadSchema }),
    ctrl.markNotificationsReadHandler
  );

  router.get(
    '/projects/:id/albums',
    authorize('media.read', 'project'),
    validate({ params: idParamSchema }),
    ctrl.listAlbumsHandler
  );
  router.post(
    '/projects/:id/albums',
    authorize('media.write', 'project'),
    writeLimiter,
    validate({ params: idParamSchema, body: createAlbumSchema }),
    ctrl.createAlbumHandler
  );
  router.post(
    '/albums/:albumId/items',
    authorize('media.write', 'album'),
    writeLimiter,
    validate({ params: albumParamSchema, body: mediaItemSchema }),
    ctrl.addMediaItemHandler
  );
  router.patch(
    '/media-items/:itemId',
    authorize('media.write', 'mediaItem'),
    writeLimiter,
    validate({ params: mediaItemParamSchema, body: updateMediaItemSchema }),
    ctrl.updateMediaItemHandler
  );
  router.post(
    '/media-items/:itemId/remove',
    authorize('mediaItem.remove', 'mediaItem'),
    writeLimiter,
    validate({ params: mediaItemParamSchema, body: optionalReasonBodySchema }),
    ctrl.removeMediaItemHandler
  );

  return router;
}
