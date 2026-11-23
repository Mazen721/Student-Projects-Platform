import axios from 'axios';
import { api } from './api';

const directUploadClient = axios.create({
  withCredentials: false,
});

export async function uploadFileToCloudinary({
  file,
  purpose,
  projectId,
  onProgress,
  signal,
}) {
  const signRes = await api.post(
    '/uploads/sign',
    {
      purpose,
      ...(projectId ? { projectId } : {}),
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      bytes: file.size,
    },
    { signal }
  );

  const signed = signRes.data.data;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signed.apiKey);
  formData.append('timestamp', String(signed.timestamp));
  formData.append('signature', signed.signature);
  formData.append('folder', signed.folder);
  formData.append('public_id', signed.publicId);
  formData.append('type', signed.type);
  formData.append('allowed_formats', signed.allowedFormats);

  const uploadRes = await directUploadClient.post(signed.uploadUrl, formData, {
    signal,
    onUploadProgress(event) {
      if (event.total && typeof onProgress === 'function') {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(percent);
      }
    },
  });

  const payload = uploadRes.data;
  return {
    public_id: payload.public_id,
    version: payload.version,
    signature: payload.signature,
    resource_type: payload.resource_type,
    type: payload.type,
    format: payload.format,
    bytes: payload.bytes,
    secure_url: payload.secure_url,
    original_filename: payload.original_filename || file.name,
  };
}
