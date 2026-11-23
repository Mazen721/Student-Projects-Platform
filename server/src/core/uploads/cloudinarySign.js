import crypto from 'node:crypto';
import { PURPOSE_POLICIES, UPLOAD_PURPOSES, resolveResourceType } from '@spp/shared/constants';
import cloudinary from '../../config/cloudinary.js';
import { env } from '../../config/env.js';
import { AppError } from '../errors/AppError.js';
import PendingUpload from './pendingUpload.model.js';

const PROJECT_SCOPED_PURPOSES = new Set([
  UPLOAD_PURPOSES.DELIVERABLE,
  UPLOAD_PURPOSES.GALLERY,
  UPLOAD_PURPOSES.COVER,
  UPLOAD_PURPOSES.SHOWCASE,
]);

function extractExtension(fileName) {
  const idx = String(fileName || '').lastIndexOf('.');
  if (idx === -1) return '';
  return fileName.slice(idx + 1).trim().toLowerCase();
}

function buildFolder(purpose, { projectId, userId }) {
  if (PROJECT_SCOPED_PURPOSES.has(purpose) || (purpose === UPLOAD_PURPOSES.CHAT && projectId)) {
    if (!projectId) {
      throw new AppError('UPLOAD_INVALID');
    }
    return `spp/projects/${projectId}/${purpose}`;
  }
  if (purpose === UPLOAD_PURPOSES.AVATAR || purpose === UPLOAD_PURPOSES.CHAT) {
    return `spp/users/${userId}/${purpose}`;
  }
  if (purpose === UPLOAD_PURPOSES.FORM) {
    return 'spp/colleges/forms';
  }
  return 'spp/university';
}

export async function signDirectUpload({ userId, purpose, projectId, fileName, mimeType, bytes }) {
  const policy = PURPOSE_POLICIES[purpose];
  if (!policy) {
    throw new AppError('UPLOAD_INVALID');
  }

  const normalizedMime = String(mimeType || '').toLowerCase();
  const ext = extractExtension(fileName);
  if (
    !policy.allowedMimes.includes(normalizedMime) ||
    !policy.allowedFormats.includes(ext) ||
    bytes > policy.maxBytes
  ) {
    throw new AppError('UPLOAD_INVALID');
  }

  const folder = buildFolder(purpose, { projectId, userId });
  const publicId = `tmp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const resourceType = resolveResourceType(normalizedMime, ext);
  const type = policy.deliveryType;
  const allowedFormats = policy.allowedFormats.join(',');

  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
      public_id: publicId,
      type,
      allowed_formats: allowedFormats,
    },
    env.CLOUDINARY_API_SECRET
  );

  await PendingUpload.create({
    publicId,
    purpose,
    userId,
    projectId: projectId || null,
    folder,
    resourceType,
    deliveryType: type,
    allowedFormats: [...policy.allowedFormats],
    maxBytes: policy.maxBytes,
  });

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
    publicId,
    resourceType,
    type,
    allowedFormats,
    maxBytes: policy.maxBytes,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
  };
}

export function getSignedDeliveryUrl(fileRef, expiresInSeconds = 900) {
  if (!fileRef) return null;
  if (fileRef.deliveryType !== 'authenticated') {
    return fileRef.url;
  }
  return cloudinary.url(fileRef.publicId, {
    type: 'authenticated',
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    resource_type: fileRef.resourceType || 'image',
    secure: true,
  });
}
