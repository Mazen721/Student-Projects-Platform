import { z } from 'zod';
import {
  MAX_MESSAGE_LENGTH,
  MEDIA_KIND_VALUES,
  MEDIA_VISIBILITY_VALUES,
  SCOPE_TYPES,
} from '../constants/index.js';
import {
  cloudinaryUploadResultSchema,
  linkRefSchema,
  objectIdSchema,
} from './common.js';

export const createDirectChannelSchema = z
  .object({
    supervisorId: objectIdSchema.optional(),
    studentId: objectIdSchema.optional(),
  })
  .strict()
  .refine((val) => Boolean(val.supervisorId) !== Boolean(val.studentId), {
    message: 'validation.required',
  });

export const sendMessageSchema = z
  .object({
    text: z.string().trim().max(MAX_MESSAGE_LENGTH, 'validation.maxLength').optional(),
    attachments: z.array(cloudinaryUploadResultSchema).max(5).default([]),
    replyToId: objectIdSchema.optional(),
    mentions: z.array(objectIdSchema).max(20).default([]),
  })
  .strict()
  .refine((msg) => Boolean(msg.text && msg.text.length > 0) || msg.attachments.length > 0, {
    message: 'validation.required',
    path: ['text'],
  });

export const commentSchema = z
  .object({
    targetType: z.enum(['submission', 'deliverable', 'task'], { message: 'validation.invalidEnum' }),
    targetId: objectIdSchema,
    text: z.string().trim().min(1, 'validation.required').max(2000, 'validation.maxLength'),
    parentId: objectIdSchema.optional(),
    mentions: z.array(objectIdSchema).max(20).default([]),
  })
  .strict();

export const announcementSchema = z
  .object({
    scopeType: z.enum(
      [SCOPE_TYPES.UNIVERSITY, SCOPE_TYPES.COLLEGE, SCOPE_TYPES.DEPARTMENT, 'supervision'],
      { message: 'validation.invalidEnum' }
    ),
    scopeId: objectIdSchema.optional(),
    title: z.string().trim().min(3, 'validation.minLength').max(180, 'validation.maxLength'),
    body: z.string().trim().min(5, 'validation.minLength').max(4000, 'validation.maxLength'),
  })
  .strict();

export const markNotificationsReadSchema = z
  .object({
    ids: z.array(objectIdSchema).max(100).optional(),
    all: z.boolean().optional(),
  })
  .strict()
  .refine((val) => Boolean(val.all) || (Array.isArray(val.ids) && val.ids.length > 0), {
    message: 'validation.minItems',
  });

export const createAlbumSchema = z
  .object({
    title: z.string().trim().min(2, 'validation.minLength').max(120, 'validation.maxLength'),
  })
  .strict();

export const mediaItemSchema = z
  .object({
    kind: z.enum(MEDIA_KIND_VALUES, { message: 'validation.invalidEnum' }),
    upload: cloudinaryUploadResultSchema.optional(),
    link: linkRefSchema.optional(),
    caption: z.string().trim().max(300, 'validation.maxLength').optional(),
    visibility: z.enum(MEDIA_VISIBILITY_VALUES, { message: 'validation.invalidEnum' }).default('private'),
  })
  .strict()
  .refine(
    (item) => (item.kind === 'photo' ? Boolean(item.upload) && !item.link : Boolean(item.link) && !item.upload),
    { message: 'validation.required' }
  );

export const updateMediaItemSchema = z
  .object({
    caption: z.string().trim().max(300, 'validation.maxLength').optional(),
    visibility: z.enum(MEDIA_VISIBILITY_VALUES, { message: 'validation.invalidEnum' }).optional(),
  })
  .strict();
