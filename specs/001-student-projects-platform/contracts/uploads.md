# Contract: uploads (core/uploads) — Cloudinary signed direct uploads

See [research.md R-10](../research.md#r-10--cloudinary-signed-direct-uploads).

## 1. Request a signature

`POST /api/v1/uploads/sign` — `authorize('upload.sign', <purpose resource>)`, limiter 30 / 10 min
per account.

Body `signUploadSchema`:
```json
{ "purpose": "deliverable", "projectId": "665f…", "fileName": "تقرير.pdf", "mimeType": "application/pdf", "bytes": 2483021 }
```
`purpose` ∈ `deliverable | gallery | avatar | cover | form | chat | showcase | universityLogo`.

Server pre-checks `mimeType` ∈ strict allow-list for the purpose and `bytes ≤ 10 MB`
(`shared/src/constants/fileTypes.js`) → otherwise `400 UPLOAD_INVALID` with
`ar.errors.UPLOAD_INVALID` (suggests a GitHub/YouTube/Drive link for large files, US3-6):
- Images (`avatar`, `cover`, `gallery`, `universityLogo`, `showcase`): `image/jpeg`, `image/png`, `image/webp` only (`.svg`, `.html`, `.js` strictly prohibited to prevent stored XSS).
- Documents (`deliverable`, `form`, `chat`): `application/pdf`, `.docx`, `.pptx`, `.zip`, plus `image/jpeg|png|webp` (macro-enabled `.docm`/`.xlsm`/`.pptm`, `.svg`, `.html`, `.js`, executables strictly prohibited).
- `LinkRef` URLs: `https://` only (`javascript:`/`data:` rejected); YouTube (`youtube.com`/`youtu.be`), Google Drive (`drive.google.com`), GitHub (`github.com`); embeds use extracted IDs inside `<iframe sandbox="allow-scripts allow-same-origin allow-presentation">`.

Response:
```json
{ "data": {
  "cloudName": "…", "apiKey": "…", "timestamp": 1795000000,
  "signature": "sha1…", "folder": "spp/projects/665f…/deliverables",
  "publicId": "tmp_7f3c…", "resourceType": "image|raw", "type": "upload|authenticated",
  "allowedFormats": "pdf", "maxBytes": 10485760,
  "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud>/<resourceType>/upload"
} }
```
Signed params: `timestamp, folder, public_id, type, allowed_formats`. A `pendinguploads` row
is created (TTL 24 h).

## 2. Browser uploads directly to Cloudinary

`multipart/form-data` POST to `uploadUrl` with `file`, `api_key`, `timestamp`, `signature`,
`folder`, `public_id`, `type`, `allowed_formats`. Progress via Axios `onUploadProgress`
(separate Axios instance without credentials/interceptors).

## 3. Attach to a domain object

The client sends the Cloudinary response subset as `CloudinaryUploadResult`:
```json
{ "public_id": "spp/projects/665f…/deliverables/tmp_7f3c…", "version": 1795000001,
  "signature": "…", "resource_type": "image", "type": "authenticated",
  "format": "pdf", "bytes": 2483021, "secure_url": "https://…", "original_filename": "تقرير" }
```
inside the domain request (e.g. `files[]` of a submission). Server `verifyUpload(uploadResult, { userId, expectedPurpose, expectedProjectId })`:
1. `verify_api_response_signature(public_id, version, signature)` ✔
2. Matching `pendinguploads` record exists for `{ publicId, userId, purpose, projectId }` and `public_id` starts with the signed folder ✔
3. `bytes ≤ maxBytes`, `format` ∈ strict allow-list ✔
4. Stores `FileRef`, deletes `pendinguploads` row. Any failure → `400 UPLOAD_INVALID` and best-effort `try/catch` `cloudinary.uploader.destroy(public_id)` (logged on transient failure; 24h `cleanup` cron removes any remaining orphans).

## 4. Delivery

- `type: upload` (public): stored `secure_url`, rendered with transformation params
  (`f_auto,q_auto,w_…`).
- `type: authenticated` (deliverables, chat, private media): API returns short-lived signed
  URLs (`cloudinary.url(public_id, { type: 'authenticated', sign_url: true, expires_at: now + 900, resource_type })`, 15 min TTL)
  only in authorized responses. Losing project access or admin moderation immediately stops URL issuance (and moderated private assets call `cloudinary.uploader.destroy`).
