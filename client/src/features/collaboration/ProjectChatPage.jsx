import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  AtSign,
  FileText,
  MessageSquare,
  Paperclip,
  Reply,
  Search,
  Send,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { CHANNEL_KINDS, ROLES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatNumber } from '@/lib/format';
import { connectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  Avatar,
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
  useChannelMessagesQuery,
  useCreateDirectChannelMutation,
  useMarkChannelReadMutation,
  useModerateMessageMutation,
  useMyChannelsQuery,
  useProjectChannelsQuery,
  useSearchChannelMessagesQuery,
  useSendMessageMutation,
} from './collaborationApi';

const ADMIN_ROLES = new Set([
  ROLES.UNIVERSITY_ADMIN,
  ROLES.COLLEGE_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
]);

function getChannelLabel(channel) {
  if (channel.kind === CHANNEL_KINDS.TEAM_ONLY) return ar.chat.teamOnly;
  if (channel.kind === CHANNEL_KINDS.DIRECT) return ar.chat.direct;
  return ar.chat.projectGroup;
}

function MessageBubble({ msg, isMine, isAdmin, onReply, onModerate }) {
  return (
    <div className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-xs ${
          isMine ? 'bg-navy text-white' : 'border border-line bg-white text-ink'
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
          <span className={`font-bold ${isMine ? 'text-gold-light' : 'text-navy'}`}>
            {msg.sender?.name}
          </span>
          <span className={isMine ? 'text-white/70' : 'text-muted'}>
            {formatDateTime(msg.createdAt)}
          </span>
        </div>

        {msg.replyTo && (
          <div
            className={`mb-2 rounded-lg px-2.5 py-1 text-xs ${
              isMine ? 'bg-navy-light text-white/90' : 'bg-app-bg text-muted'
            }`}
          >
            <span className="font-bold">{msg.replyTo.senderName}</span>
            {': '}
            <span>{msg.replyTo.text}</span>
          </div>
        )}

        <p className="whitespace-pre-line text-sm">{msg.text}</p>

        {(msg.attachments || []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.attachments.map((att, idx) => (
              <a
                key={idx}
                href={att.signedUrl || att.url}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
                  isMine ? 'bg-navy-light text-white' : 'border border-line bg-app-bg text-navy'
                }`}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{att.originalName || ar.tracking.attachments}</span>
              </a>
            ))}
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.7rem]">
          <span className={isMine ? 'text-white/70' : 'text-muted'}>
            {t('chat.readByCount', { count: formatNumber((msg.readBy || []).length) })}
          </span>
          <div className="flex items-center gap-1">
            {!msg.isRemoved && (
              <button
                type="button"
                aria-label={ar.chat.replyTo}
                onClick={() => onReply(msg)}
                className="rounded p-1 hover:bg-black/10 cursor-pointer"
              >
                <Reply className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            {isAdmin && !msg.isRemoved && (
              <button
                type="button"
                aria-label={ar.chat.removeMessage}
                onClick={() => onModerate(msg)}
                className="rounded p-1 hover:bg-black/10 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 text-[#fca5a5]" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectChatPage({ project = null }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const isProjectView = Boolean(project?.id);
  const myChannelsQuery = useMyChannelsQuery(!isProjectView);
  const projectChannelsQuery = useProjectChannelsQuery(project?.id);
  const channels = useMemo(
    () => (isProjectView ? projectChannelsQuery.data : myChannelsQuery.data) || [],
    [isProjectView, projectChannelsQuery.data, myChannelsQuery.data]
  );
  const channelsLoading = isProjectView ? projectChannelsQuery.isLoading : myChannelsQuery.isLoading;

  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const activeChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) || channels[0] || null,
    [channels, selectedChannelId]
  );

  const { data: rawMessages = [], isLoading: messagesLoading } = useChannelMessagesQuery(
    activeChannel?.id
  );
  const messages = useMemo(() => [...rawMessages].reverse(), [rawMessages]);

  const [searchTerm, setSearchTerm] = useState('');
  const searchQuery = useSearchChannelMessagesQuery(activeChannel?.id, searchTerm);
  const sendMutation = useSendMessageMutation();
  const markReadMutation = useMarkChannelReadMutation();
  const moderateMutation = useModerateMessageMutation();
  const directMutation = useCreateDirectChannelMutation();

  const [draftText, setDraftText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showUploader, setShowUploader] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIds, setMentionIds] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [moderatingMsg, setModeratingMsg] = useState(null);
  const [moderateReason, setModerateReason] = useState('');
  const [directModalOpen, setDirectModalOpen] = useState(false);
  const [directTargetId, setDirectTargetId] = useState('');
  const lastTypingEmitRef = useRef(0);

  const isAdmin = roles.some((r) => ADMIN_ROLES.has(r.role));
  const isTeamMember = (project?.activeMemberIds || []).some(
    (id) => String(id) === String(user?.id)
  );
  const isSupervisor = useMemo(() => {
    if (!project) return false;
    const supIds = [
      project.supervision?.primaryId,
      project.supervision?.reviewerId,
      ...(project.supervision?.coSupervisorIds || []),
      ...(project.supervision?.mentorIds || []),
    ]
      .filter(Boolean)
      .map(String);
    return supIds.includes(String(user?.id));
  }, [project, user?.id]);

  const visibleChannels = useMemo(
    () =>
      channels.filter((ch) => !(ch.kind === CHANNEL_KINDS.TEAM_ONLY && isSupervisor)),
    [channels, isSupervisor]
  );

  useEffect(() => {
    const channelId = activeChannel?.id;
    if (!channelId) return undefined;
    const socket = getSocket() || connectSocket();
    if (!socket) return undefined;

    socket.emit('channel:join', { channelId });

    const refreshMessages = () => {
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] });
      qc.invalidateQueries({ queryKey: ['channels', 'mine'] });
      if (project?.id) {
        qc.invalidateQueries({ queryKey: ['projects', project.id, 'channels'] });
      }
    };
    const onTyping = (payload) => {
      if (payload?.channelId !== channelId) return;
      setTypingUser(payload.isTyping ? payload.name : null);
    };

    socket.on('message:new', refreshMessages);
    socket.on('message:removed', refreshMessages);
    socket.on('receipt:update', refreshMessages);
    socket.on('typing', onTyping);

    return () => {
      socket.emit('channel:leave', { channelId });
      socket.off('message:new', refreshMessages);
      socket.off('message:removed', refreshMessages);
      socket.off('receipt:update', refreshMessages);
      socket.off('typing', onTyping);
      setTypingUser(null);
    };
  }, [activeChannel?.id, project?.id, qc]);

  useEffect(() => {
    const channelId = activeChannel?.id;
    const lastMsg = messages[messages.length - 1];
    if (!channelId || !lastMsg) return;
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('message:read', { channelId, upToMessageId: lastMsg.id });
    } else {
      markReadMutation.mutate({ channelId, upToMessageId: lastMsg.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel?.id, messages.length]);

  function handleDraftChange(val) {
    setDraftText(val);
    const socket = getSocket();
    const channelId = activeChannel?.id;
    if (!socket?.connected || !channelId) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current >= 2000) {
      lastTypingEmitRef.current = now;
      socket.emit(val.trim() ? 'typing:start' : 'typing:stop', { channelId });
    }
  }

  function handleAddMention(member) {
    setMentionIds((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setDraftText((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}@${member.name} `);
    setShowMentions(false);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!activeChannel?.id) return;
    if (!draftText.trim() && attachments.length === 0) return;

    const payload = {
      channelId: activeChannel.id,
      text: draftText.trim() || undefined,
      attachments,
      replyToId: replyTo?.id,
      mentions: mentionIds,
    };

    try {
      const socket = getSocket();
      if (socket?.connected) {
        await new Promise((resolve, reject) => {
          socket.emit('message:send', { ...payload, clientId: String(Date.now()) }, (ack) => {
            if (ack?.ok) resolve(ack.message);
            else reject(new Error(ack?.error?.message || ar.common.errorTitle));
          });
        });
        qc.invalidateQueries({ queryKey: ['channels', activeChannel.id, 'messages'] });
      } else {
        await sendMutation.mutateAsync(payload);
      }
      setDraftText('');
      setAttachments([]);
      setMentionIds([]);
      setReplyTo(null);
      setShowUploader(false);
    } catch (err) {
      addToast({ message: err?.message || getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleModerate() {
    try {
      await moderateMutation.mutateAsync({
        messageId: moderatingMsg.id,
        reason: moderateReason,
        channelId: activeChannel.id,
      });
      setModeratingMsg(null);
      setModerateReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleStartDirect(e) {
    e.preventDefault();
    if (!project?.id || !directTargetId) return;
    try {
      const created = await directMutation.mutateAsync({
        projectId: project.id,
        ...(isTeamMember ? { supervisorId: directTargetId } : { studentId: directTargetId }),
      });
      setSelectedChannelId(created.id);
      setDirectModalOpen(false);
      setDirectTargetId('');
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const directCandidates = useMemo(() => {
    if (!project) return [];
    if (isTeamMember) {
      const sups = [
        project.supervisionDetails?.primary,
        project.supervisionDetails?.reviewer,
        ...(project.supervisionDetails?.coSupervisors || []),
        ...(project.supervisionDetails?.mentors || []),
      ].filter(Boolean);
      return sups;
    }
    if (isSupervisor) {
      return (project.teamMembers || []).map((m) => ({ id: m.userId, name: m.name }));
    }
    return [];
  }, [project, isTeamMember, isSupervisor]);

  const displayedMessages = searchTerm.trim() ? searchQuery.data || [] : messages;
  const channelMembers = (activeChannel?.members || []).filter(
    (m) => String(m.id) !== String(user?.id)
  );

  return (
    <div className="space-y-4">
      {!isProjectView && (
        <>
          <Helmet title={`${ar.chat.pageTitle} — ${ar.common.platformName}`} />
          <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white">
            <h1 className="text-2xl font-extrabold">{ar.chat.pageTitle}</h1>
          </header>
        </>
      )}

      {channelsLoading ? (
        <CardSkeleton />
      ) : visibleChannels.length === 0 ? (
        <EmptyState icon={MessageSquare} title={ar.chat.noChannels} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <aside className="space-y-2 lg:col-span-4">
            <Card>
              <div className="space-y-2">
                {project && directCandidates.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setDirectModalOpen(true)}
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    <span>{ar.chat.startDirectChat}</span>
                  </Button>
                )}

                <div className="space-y-1">
                  {visibleChannels.map((ch) => {
                    const isActive = ch.id === activeChannel?.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          setSelectedChannelId(ch.id);
                          setSearchTerm('');
                        }}
                        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-sm font-bold transition cursor-pointer ${
                          isActive
                            ? 'bg-gold text-navy'
                            : 'bg-app-bg text-ink hover:bg-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate">{getChannelLabel(ch)}</p>
                          {ch.title && (
                            <p className="truncate text-xs opacity-75">{ch.title}</p>
                          )}
                        </div>
                        {ch.unreadCount > 0 && (
                          <Badge tone="featured">{formatNumber(ch.unreadCount)}</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          </aside>

          <section className="lg:col-span-8">
            <Card
              title={activeChannel ? getChannelLabel(activeChannel) : ar.chat.selectChannel}
              actions={
                activeChannel && (
                  <div className="relative w-48 sm:w-64">
                    <Search
                      className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-muted"
                      aria-hidden="true"
                    />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={ar.chat.searchMessages}
                      className="ps-9"
                    />
                  </div>
                )
              }
            >
              {messagesLoading ? (
                <CardSkeleton />
              ) : (
                <div className="flex flex-col space-y-4">
                  <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl bg-app-bg p-3">
                    {displayedMessages.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted">
                        {searchTerm.trim() ? ar.chat.searchEmpty : ar.common.noData}
                      </p>
                    ) : (
                      displayedMessages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          msg={msg}
                          isMine={String(msg.senderId) === String(user?.id)}
                          isAdmin={isAdmin}
                          onReply={setReplyTo}
                          onModerate={setModeratingMsg}
                        />
                      ))
                    )}
                  </div>

                  {typingUser && (
                    <p className="text-xs font-semibold text-muted">
                      {t('chat.typingNow', { name: typingUser })}
                    </p>
                  )}

                  {replyTo && (
                    <div className="flex items-center justify-between rounded-xl bg-app-bg px-3 py-2 text-xs">
                      <span className="truncate text-ink">
                        {ar.chat.replyTo} {replyTo.sender?.name}
                        {': '}
                        {replyTo.text}
                      </span>
                      <button
                        type="button"
                        aria-label={ar.chat.cancelReply}
                        onClick={() => setReplyTo(null)}
                        className="text-muted hover:text-navy cursor-pointer"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {showMentions && channelMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-app-bg p-2">
                      {channelMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleAddMention(member)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-navy border border-line cursor-pointer"
                        >
                          <Avatar src={member.avatar?.url} name={member.name} size="sm" />
                          <span>{member.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {showUploader && (
                    <FileUploader
                      purpose="chat"
                      projectId={activeChannel?.projectId || project?.id}
                      onUploaded={(res) => setAttachments((prev) => [...prev, res])}
                      onError={(msg) => addToast({ message: msg, tone: 'error' })}
                    />
                  )}

                  <form
                    onSubmit={handleSend}
                    className="sticky bottom-0 flex items-center gap-2 border-t border-line bg-white pt-3"
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={ar.chat.attachFile}
                      onClick={() => setShowUploader((v) => !v)}
                    >
                      <Paperclip className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={ar.chat.mentionMember}
                      onClick={() => setShowMentions((v) => !v)}
                    >
                      <AtSign className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Input
                      value={draftText}
                      onChange={(e) => handleDraftChange(e.target.value)}
                      placeholder={ar.chat.typeMessage}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      variant="gold"
                      loading={sendMutation.isPending}
                    >
                      <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                      <span>{ar.chat.send}</span>
                    </Button>
                  </form>
                </div>
              )}
            </Card>
          </section>
        </div>
      )}

      <Modal
        open={Boolean(moderatingMsg)}
        onClose={() => setModeratingMsg(null)}
        title={ar.chat.removeMessage}
      >
        <div className="space-y-4">
          <Field label={ar.chat.removeReason} required>
            <Input value={moderateReason} onChange={(e) => setModerateReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModeratingMsg(null)}>
              {ar.common.cancel}
            </Button>
            <Button
              variant="navy"
              loading={moderateMutation.isPending}
              onClick={handleModerate}
            >
              {ar.common.confirm}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={directModalOpen}
        onClose={() => setDirectModalOpen(false)}
        title={ar.chat.startDirectChat}
      >
        <form onSubmit={handleStartDirect} className="space-y-4">
          <Field label={ar.chat.selectRecipient} required>
            <Select
              value={directTargetId}
              onChange={(e) => setDirectTargetId(e.target.value)}
              required
            >
              <option value="">{ar.common.selectPlaceholder}</option>
              {directCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDirectModalOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={directMutation.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
