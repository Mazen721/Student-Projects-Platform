import { MAX_UPLOAD_BYTES } from './limits.js';

export const UPLOAD_PURPOSES = Object.freeze({
  DELIVERABLE: 'deliverable',
  GALLERY: 'gallery',
  AVATAR: 'avatar',
  COVER: 'cover',
  FORM: 'form',
  CHAT: 'chat',
  SHOWCASE: 'showcase',
  UNIVERSITY_LOGO: 'universityLogo',
});

export const UPLOAD_PURPOSE_VALUES = Object.freeze(Object.values(UPLOAD_PURPOSES));

export const IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const IMAGE_EXTENSIONS = Object.freeze(['jpg', 'jpeg', 'png', 'webp']);

export const DOCUMENT_MIME_TYPES = Object.freeze([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  ...IMAGE_MIME_TYPES,
]);

export const DOCUMENT_EXTENSIONS = Object.freeze([
  'pdf',
  'docx',
  'pptx',
  'zip',
  ...IMAGE_EXTENSIONS,
]);

export const PURPOSE_POLICIES = Object.freeze({
  deliverable: {
    allowedMimes: DOCUMENT_MIME_TYPES,
    allowedFormats: DOCUMENT_EXTENSIONS,
    deliveryType: 'authenticated',
    maxBytes: MAX_UPLOAD_BYTES,
  },
  form: {
    allowedMimes: DOCUMENT_MIME_TYPES,
    allowedFormats: DOCUMENT_EXTENSIONS,
    deliveryType: 'upload',
    maxBytes: MAX_UPLOAD_BYTES,
  },
  chat: {
    allowedMimes: DOCUMENT_MIME_TYPES,
    allowedFormats: DOCUMENT_EXTENSIONS,
    deliveryType: 'authenticated',
    maxBytes: MAX_UPLOAD_BYTES,
  },
  gallery: {
    allowedMimes: IMAGE_MIME_TYPES,
    allowedFormats: IMAGE_EXTENSIONS,
    deliveryType: 'authenticated',
    maxBytes: MAX_UPLOAD_BYTES,
  },
  avatar: {
    allowedMimes: IMAGE_MIME_TYPES,
    allowedFormats: IMAGE_EXTENSIONS,
    deliveryType: 'upload',
    maxBytes: MAX_UPLOAD_BYTES,
  },
  cover: {
    allowedMimes: IMAGE_MIME_TYPES,
    allowedFormats: IMAGE_EXTENSIONS,
    deliveryType: 'upload',
    maxBytes: MAX_UPLOAD_BYTES,
  },
  showcase: {
    allowedMimes: IMAGE_MIME_TYPES,
    allowedFormats: IMAGE_EXTENSIONS,
    deliveryType: 'upload',
    maxBytes: MAX_UPLOAD_BYTES,
  },
  universityLogo: {
    allowedMimes: IMAGE_MIME_TYPES,
    allowedFormats: IMAGE_EXTENSIONS,
    deliveryType: 'upload',
    maxBytes: MAX_UPLOAD_BYTES,
  },
});

export const LINK_KINDS = Object.freeze({
  GITHUB: 'github',
  YOUTUBE: 'youtube',
  GDRIVE: 'gdrive',
  OTHER: 'other',
});

export const LINK_KIND_VALUES = Object.freeze(Object.values(LINK_KINDS));

export const LINK_HOST_ALLOWLIST = Object.freeze({
  github: ['github.com'],
  youtube: ['youtube.com', 'youtu.be'],
  gdrive: ['drive.google.com'],
});

export function resolveResourceType(mimeType, format) {
  const normalizedMime = (mimeType || '').toLowerCase();
  const normalizedFormat = (format || '').toLowerCase();
  if (
    IMAGE_MIME_TYPES.includes(normalizedMime) ||
    normalizedMime === 'application/pdf' ||
    IMAGE_EXTENSIONS.includes(normalizedFormat) ||
    normalizedFormat === 'pdf'
  ) {
    return 'image';
  }
  return 'raw';
}
