import { useState } from 'react';
import { MessageSquare, Reply, Send, Trash2 } from 'lucide-react';
import { ROLES } from '@spp/shared/constants';
import ar from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Avatar, Button, CardSkeleton, Field, Input, Modal, Textarea } from '@/components/ui';
import {
  useCommentsQuery,
  useCreateCommentMutation,
  useModerateCommentMutation,
} from './collaborationApi';

const ADMIN_ROLES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

export function CommentThread({ targetType, targetId, canWrite = true }) {
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);
  const { data: comments = [], isLoading } = useCommentsQuery(targetType, targetId);
  const createMutation = useCreateCommentMutation();
  const moderateMutation = useModerateCommentMutation();

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [reason, setReason] = useState('');

  const isAdmin = roles.some((r) => ADMIN_ROLES.has(r.role));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await createMutation.mutateAsync({
        targetType,
        targetId,
        text: text.trim(),
        ...(replyTo ? { parentId: replyTo.id } : {}),
      });
      setText('');
      setReplyTo(null);
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleRemove() {
    try {
      await moderateMutation.mutateAsync({
        commentId: removingId,
        reason,
        targetType,
        targetId,
      });
      setRemovingId(null);
      setReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  if (isLoading) {
    return <CardSkeleton />;
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-app-bg p-3">
      <div className="flex items-center gap-2 text-xs font-extrabold text-navy">
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        <span>{ar.chat.commentsTitle}</span>
      </div>

      {comments.length === 0 ? (
        <p className="text-xs text-muted">{ar.chat.noCommentsYet}</p>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl border border-line bg-white p-2.5 text-sm ${
                comment.parentId ? 'ms-6' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar src={comment.author?.avatar?.url} name={comment.author?.name} size="sm" />
                  <div>
                    <p className="text-xs font-bold text-navy">{comment.author?.name}</p>
                    <p className="text-[0.7rem] text-muted">
                      {formatRelativeTime(comment.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canWrite && !comment.isRemoved && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={ar.chat.replyAction}
                      onClick={() => setReplyTo(comment)}
                    >
                      <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                  {isAdmin && !comment.isRemoved && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={ar.chat.removeComment}
                      onClick={() => setRemovingId(comment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#b91c1c]" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
              <p
                className={`mt-1.5 text-sm ${
                  comment.isRemoved ? 'italic text-muted' : 'text-ink'
                }`}
              >
                {comment.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <form onSubmit={handleSubmit} className="space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1 text-xs text-muted">
              <span>
                {ar.chat.replyTo} {replyTo.author?.name}
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="font-bold text-navy cursor-pointer"
              >
                {ar.chat.cancelReply}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={ar.chat.addCommentPlaceholder}
            />
            <Button
              type="submit"
              variant="gold"
              loading={createMutation.isPending}
              aria-label={ar.chat.send}
            >
              <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </div>
        </form>
      )}

      <Modal
        open={Boolean(removingId)}
        onClose={() => setRemovingId(null)}
        title={ar.chat.removeComment}
      >
        <div className="space-y-4">
          <Field label={ar.chat.removeReason} required>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemovingId(null)}>
              {ar.common.cancel}
            </Button>
            <Button
              variant="navy"
              loading={moderateMutation.isPending}
              onClick={handleRemove}
            >
              {ar.common.confirm}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
