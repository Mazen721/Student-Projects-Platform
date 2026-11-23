import pino from 'pino';
import { cloudinaryUploadResultSchema } from '@spp/shared/schemas';
import cloudinary from '../../config/cloudinary.js';
import { env } from '../../config/env.js';
import { AppError } from '../errors/AppError.js';
import PendingUpload from './pendingUpload.model.js';

const logger = pino({ level: env.NODE_ENV === 'test' ? 'silent' : 'warn' });

async function cleanupRejectedAsset(uploadResult) {
  if (!uploadResult?.public_id) return;
  try {
    await cloudinary.uploader.destroy(uploadResult.public_id, {
      resource_type: uploadResult.resource_type || 'image',
      type: uploadResult.type || 'upload',
    });
  } catch (err) {
    logger.warn({ err, publicId: uploadResult.public_id }, 'Failed best-effort orphan Cloudinary destroy');
  }
}

export async function verifyUpload(rawResult, { userId, expectedPurpose, expectedProjectId = null }) {
  const parsed = cloudinaryUploadResultSchema.safeParse(rawResult);
  if (!parsed.success) {
    await cleanupRejectedAsset(rawResult);
    throw new AppError('UPLOAD_INVALID');
  }

  const upload = parsed.data;
  const sigValid = cloudinary.utils.verify_api_response_signature(
    upload.public_id,
    upload.version,
    upload.signature
  );
  if (!sigValid) {
    await cleanupRejectedAsset(upload);
    throw new AppError('UPLOAD_INVALID');
  }

  const leafPublicId = upload.public_id.split('/').pop();
  const pendingQuery = {
    userId,
    purpose: expectedPurpose,
    publicId: leafPublicId,
    ...(expectedProjectId ? { projectId: expectedProjectId } : {}),
  };

  const pending = await PendingUpload.findOne(pendingQuery).lean();
  const format = upload.format.toLowerCase();

  const matchesPolicy =
    Boolean(pending) &&
    upload.public_id.startsWith(`${pending.folder}/`) &&
    upload.resource_type === pending.resourceType &&
    upload.type === pending.deliveryType &&
    upload.bytes <= pending.maxBytes &&
    pending.allowedFormats.includes(format);

  if (!matchesPolicy) {
    await cleanupRejectedAsset(upload);
    throw new AppError('UPLOAD_INVALID');
  }

  await PendingUpload.deleteOne({ _id: pending._id });

  return {
    publicId: upload.public_id,
    url: upload.secure_url,
    resourceType: upload.resource_type,
    deliveryType: upload.type,
    format,
    bytes: upload.bytes,
    originalName: upload.original_filename || leafPublicId,
  };
}
