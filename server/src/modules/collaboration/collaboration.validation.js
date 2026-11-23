import { z } from 'zod';
import { MAX_CHAT_LIMIT } from '@spp/shared/constants';
import {
  announcementSchema,
  coerceNumberFromArabic,
  commentSchema,
  createAlbumSchema,
  createDirectChannelSchema,
  markNotificationsReadSchema,
  mediaItemSchema,
  objectIdSchema,
  paginationQuerySchema,
  reasonBodySchema,
  sendMessageSchema,
  updateMediaItemSchema,
} from '@spp/shared/schemas';

export const idParamSchema = z.object({ id: objectIdSchema });
export const channelParamSchema = z.object({ channelId: objectIdSchema });
export const messageParamSchema = z.object({ messageId: objectIdSchema });
export const albumParamSchema = z.object({ albumId: objectIdSchema });
export const mediaItemParamSchema = z.object({ itemId: objectIdSchema });

export const listMessagesQuerySchema = z.object({
  before: objectIdSchema.optional(),
  limit: coerceNumberFromArabic(
    z.number().int().min(1).max(MAX_CHAT_LIMIT).default(30)
  ).default(30),
});

export const markChannelReadBodySchema = z
  .object({
    upToMessageId: objectIdSchema.optional(),
  })
  .strict();

export const searchMessagesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1, 'validation.required').max(120, 'validation.maxLength'),
});

export const listCommentsQuerySchema = z.object({
  targetType: z.enum(['submission', 'deliverable', 'task'], { message: 'validation.invalidEnum' }),
  targetId: objectIdSchema,
});

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unread: z.enum(['true', 'false']).optional(),
});

export const optionalReasonBodySchema = z
  .object({
    reason: z.string().trim().min(3, 'validation.minLength').max(500, 'validation.maxLength').optional(),
  })
  .strict();

export {
  announcementSchema,
  commentSchema,
  createAlbumSchema,
  createDirectChannelSchema,
  markNotificationsReadSchema,
  mediaItemSchema,
  paginationQuerySchema,
  reasonBodySchema,
  sendMessageSchema,
  updateMediaItemSchema,
};
