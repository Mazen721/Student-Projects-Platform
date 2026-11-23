import { useState } from 'react';
import { Eye, EyeOff, Film, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import {
  LINK_KINDS,
  MEDIA_KINDS,
  MEDIA_VISIBILITY,
  PROPOSAL_STATUSES,
  ROLES,
} from '@spp/shared/constants';
import ar from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  Field,
  FileUploader,
  Input,
  Modal,
  Select,
} from '@/components/ui';
import {
  useAddMediaItemMutation,
  useCreateAlbumMutation,
  useProjectAlbumsQuery,
  useRemoveMediaItemMutation,
  useUpdateMediaItemMutation,
} from './collaborationApi';

const ADMIN_ROLES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

function toEmbedUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'drive.google.com') {
      const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      return match ? `https://drive.google.com/file/d/${match[1]}/preview` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function PhotoTile({ src, alt }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-navy text-gold">
        <ImageIcon className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ar.chat.mediaGallery}
      onError={() => setBroken(true)}
      className="aspect-video w-full rounded-xl object-cover"
    />
  );
}

function VideoTile({ link, caption }) {
  const embed = toEmbedUrl(link?.url);
  if (embed) {
    return (
      <iframe
        src={embed}
        title={caption || link?.title || ar.chat.mediaGallery}
        allowFullScreen
        className="aspect-video w-full rounded-2xl border border-line"
      />
    );
  }
  return (
    <a
      href={link?.url}
      target="_blank"
      rel="noreferrer"
      className="flex aspect-video w-full items-center justify-center rounded-2xl bg-navy text-gold"
    >
      <Film className="h-8 w-8" aria-hidden="true" />
    </a>
  );
}

export function MediaGalleryPage({ project }) {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const { data: albums = [], isLoading } = useProjectAlbumsQuery(project?.id);
  const createAlbumMutation = useCreateAlbumMutation();
  const addItemMutation = useAddMediaItemMutation();
  const updateItemMutation = useUpdateMediaItemMutation();
  const removeItemMutation = useRemoveMediaItemMutation();

  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const [targetAlbumId, setTargetAlbumId] = useState(null);
  const [kind, setKind] = useState(MEDIA_KINDS.PHOTO);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [linkKind, setLinkKind] = useState(LINK_KINDS.YOUTUBE);
  const [linkUrl, setLinkUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState(MEDIA_VISIBILITY.PRIVATE);
  const [removingItem, setRemovingItem] = useState(null);
  const [removeReason, setRemoveReason] = useState('');

  const isTeamMember = (project?.activeMemberIds || []).some(
    (id) => String(id) === String(user?.id)
  );
  const isAdmin = roles.some((r) => ADMIN_ROLES.has(r.role));
  const isWritable = project?.status !== PROPOSAL_STATUSES.ARCHIVED;
  const canEditMedia = isTeamMember && isWritable;

  async function handleCreateAlbum(e) {
    e.preventDefault();
    try {
      await createAlbumMutation.mutateAsync({ projectId: project.id, title: albumTitle.trim() });
      setAlbumTitle('');
      setAlbumModalOpen(false);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    try {
      await addItemMutation.mutateAsync({
        albumId: targetAlbumId,
        projectId: project.id,
        kind,
        ...(kind === MEDIA_KINDS.PHOTO
          ? { upload: uploadedFile }
          : { link: { kind: linkKind, url: linkUrl.trim() } }),
        ...(caption.trim() ? { caption: caption.trim() } : {}),
        visibility,
      });
      setTargetAlbumId(null);
      setUploadedFile(null);
      setLinkUrl('');
      setCaption('');
      setVisibility(MEDIA_VISIBILITY.PRIVATE);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleToggleVisibility(item) {
    const next =
      item.visibility === MEDIA_VISIBILITY.PUBLIC
        ? MEDIA_VISIBILITY.PRIVATE
        : MEDIA_VISIBILITY.PUBLIC;
    try {
      await updateItemMutation.mutateAsync({
        itemId: item.id,
        projectId: project.id,
        visibility: next,
      });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleRemoveItem() {
    try {
      await removeItemMutation.mutateAsync({
        itemId: removingItem.id,
        projectId: project.id,
        reason: removeReason.trim() || undefined,
      });
      setRemovingItem(null);
      setRemoveReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  if (isLoading) {
    return <CardSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-navy">{ar.chat.mediaGallery}</h2>
        {canEditMedia && (
          <Button variant="gold" onClick={() => setAlbumModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{ar.chat.newAlbum}</span>
          </Button>
        )}
      </div>

      {albums.length === 0 ? (
        <EmptyState icon={ImageIcon} title={ar.chat.noAlbumsYet} />
      ) : (
        <div className="space-y-6">
          {albums.map((album) => (
            <Card
              key={album.id}
              title={album.title}
              actions={
                canEditMedia && (
                  <Button
                    size="sm"
                    variant="navy"
                    onClick={() => setTargetAlbumId(album.id)}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>{ar.chat.addMediaItem}</span>
                  </Button>
                )
              }
            >
              {album.items.length === 0 ? (
                <p className="text-sm text-muted">{ar.chat.noMediaInAlbum}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {album.items.map((item) => (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-2xl border border-line bg-app-bg p-3"
                    >
                      {item.kind === MEDIA_KINDS.PHOTO ? (
                        <PhotoTile src={item.signedUrl || item.file?.url} alt={item.caption} />
                      ) : (
                        <VideoTile link={item.link} caption={item.caption} />
                      )}

                      {item.caption && <p className="text-sm font-bold text-ink">{item.caption}</p>}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge tone={item.visibility === MEDIA_VISIBILITY.PUBLIC ? 'success' : 'info'}>
                          {item.visibility === MEDIA_VISIBILITY.PUBLIC
                            ? ar.chat.visibilityPublic
                            : ar.chat.visibilityPrivate}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {canEditMedia && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={ar.chat.toggleVisibility}
                              onClick={() => handleToggleVisibility(item)}
                            >
                              {item.visibility === MEDIA_VISIBILITY.PUBLIC ? (
                                <EyeOff className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              )}
                            </Button>
                          )}
                          {(canEditMedia || isAdmin) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={ar.chat.removeMediaItem}
                              onClick={() => setRemovingItem(item)}
                            >
                              <Trash2 className="h-4 w-4 text-[#b91c1c]" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={albumModalOpen}
        onClose={() => setAlbumModalOpen(false)}
        title={ar.chat.newAlbum}
      >
        <form onSubmit={handleCreateAlbum} className="space-y-4">
          <Field label={ar.chat.albumTitle} required>
            <Input value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAlbumModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={createAlbumMutation.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(targetAlbumId)}
        onClose={() => setTargetAlbumId(null)}
        title={ar.chat.addMediaItem}
      >
        <form onSubmit={handleAddItem} className="space-y-4">
          <Field label={ar.projects.type}>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value={MEDIA_KINDS.PHOTO}>{ar.chat.mediaKindPhoto}</option>
              <option value={MEDIA_KINDS.VIDEO_LINK}>{ar.chat.mediaKindVideo}</option>
            </Select>
          </Field>

          {kind === MEDIA_KINDS.PHOTO ? (
            <FileUploader
              purpose="gallery"
              projectId={project.id}
              onUploaded={setUploadedFile}
              onError={(msg) => addToast({ message: msg, tone: 'error' })}
            />
          ) : (
            <div className="space-y-3">
              <Field label={ar.tracking.linkKind}>
                <Select value={linkKind} onChange={(e) => setLinkKind(e.target.value)}>
                  <option value={LINK_KINDS.YOUTUBE}>{ar.tracking.linkKind}</option>
                  <option value={LINK_KINDS.GDRIVE}>{ar.tracking.externalLinks}</option>
                </Select>
              </Field>
              <Field label={ar.tracking.linkUrl} required>
                <Input
                  dir="ltr"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  required
                />
              </Field>
            </div>
          )}

          <Field label={ar.chat.mediaCaption}>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>

          <Field label={ar.common.status}>
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value={MEDIA_VISIBILITY.PRIVATE}>{ar.chat.visibilityPrivate}</option>
              <option value={MEDIA_VISIBILITY.PUBLIC}>{ar.chat.visibilityPublic}</option>
            </Select>
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTargetAlbumId(null)}>
              {ar.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="gold"
              disabled={kind === MEDIA_KINDS.PHOTO && !uploadedFile}
              loading={addItemMutation.isPending}
            >
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(removingItem)}
        onClose={() => setRemovingItem(null)}
        title={ar.chat.removeMediaItem}
      >
        <div className="space-y-4">
          {isAdmin && !isTeamMember && (
            <Field label={ar.chat.removeReason} required>
              <Input value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemovingItem(null)}>
              {ar.common.cancel}
            </Button>
            <Button
              variant="navy"
              loading={removeItemMutation.isPending}
              onClick={handleRemoveItem}
            >
              {ar.common.confirm}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
