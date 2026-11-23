import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Award,
  Bookmark,
  EyeOff,
  Flag,
  Heart,
  Mail,
  MessageSquare,
  RotateCcw,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { ROLES, USER_STATUSES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatNumber } from '@/lib/format';
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
  Modal,
  Textarea,
} from '@/components/ui';
import {
  useCreateContactRequestMutation,
  useCreatePublicCommentMutation,
  useInvestorProjectActionMutation,
  useModeratePublicCommentMutation,
  usePublicCommentsQuery,
  usePublicProjectDetailQuery,
  useReportPublicCommentMutation,
  useVoteMutation,
} from './showcaseApi';
import { toVideoEmbedUrl } from './videoEmbed';

const THEME_STYLES = {
  navy_gold: {
    hero: 'bg-gradient-to-l from-navy to-navy-dark text-white',
    surface: 'bg-white border-line',
    accent: 'text-gold-light',
  },
  deep_navy_slate: {
    hero: 'bg-navy-dark text-white',
    surface: 'bg-[#f8fafc] border-line',
    accent: 'text-gold',
  },
  warm_ivory_navy: {
    hero: 'bg-navy text-white',
    surface: 'bg-[#fdfbf5] border-[#e5dcc5]',
    accent: 'text-gold-light',
  },
};

function CommentsSection({ projectId, slug, isAuthenticated, canModerate }) {
  const addToast = useUiStore((s) => s.addToast);
  const [commentText, setCommentText] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');

  const { data: commentsRes } = usePublicCommentsQuery(slug);
  const createComment = useCreatePublicCommentMutation(projectId, slug);
  const reportComment = useReportPublicCommentMutation(slug);
  const moderateComment = useModeratePublicCommentMutation(slug);

  const comments = commentsRes?.data || [];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await createComment.mutateAsync({ text: commentText.trim() });
      setCommentText('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleReport(e) {
    e.preventDefault();
    if (!reportTarget || !reportReason.trim()) return;
    try {
      await reportComment.mutateAsync({ id: reportTarget, reason: reportReason.trim() });
      setReportTarget(null);
      setReportReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleModerate(id, action) {
    try {
      await moderateComment.mutateAsync({ id, action });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <Card title={ar.showcase.publicCommentsTitle}>
      <div className="space-y-4">
        {isAuthenticated && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label={ar.showcase.publicCommentsTitle}>
              <Textarea
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={ar.showcase.addCommentPlaceholder}
              />
            </Field>
            <Button type="submit" variant="navy" loading={createComment.isPending}>
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              <span>{ar.showcase.submitComment}</span>
            </Button>
          </form>
        )}

        {comments.length === 0 ? (
          <p className="text-sm text-muted">{ar.showcase.noCommentsYet}</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-xl border border-line bg-app-bg p-3.5 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar src={comment.author?.avatar?.url} name={comment.author?.name} size="sm" />
                    <span className="font-bold text-navy">{comment.author?.name}</span>
                    <span className="text-xs text-muted">{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isAuthenticated && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReportTarget(comment.id)}
                      >
                        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{ar.showcase.reportComment}</span>
                      </Button>
                    )}
                    {canModerate && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleModerate(comment.id, 'hide')}
                        >
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{ar.showcase.hideComment}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleModerate(comment.id, 'restore')}
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{ar.showcase.restoreComment}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleModerate(comment.id, 'remove')}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{ar.showcase.removeComment}</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-line text-ink">{comment.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        title={ar.showcase.reportComment}
      >
        <form onSubmit={handleReport} className="space-y-4">
          <Field label={ar.showcase.reasonLabel} required>
            <Textarea
              rows={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReportTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={reportComment.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

export default function ProjectMiniSitePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const accessToken = useAuthStore((s) => s.accessToken);
  const addToast = useUiStore((s) => s.addToast);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [following, setFollowing] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const viewSentRef = useRef(false);

  const { data: project, isLoading, isError } = usePublicProjectDetailQuery(slug);
  const voteMutation = useVoteMutation(project?.id, slug);
  const investorAction = useInvestorProjectActionMutation(project?.id);
  const contactMutation = useCreateContactRequestMutation(project?.id);

  useEffect(() => {
    if (!project || viewSentRef.current) return;
    viewSentRef.current = true;
    api.post(`/public/projects/${slug}/view`).catch(() => {});
  }, [project, slug]);

  if (isLoading) return <CardSkeleton />;

  if (isError || !project) {
    return (
      <EmptyState
        title={ar.showcase.unavailable}
        actionLabel={ar.common.backHome}
        onAction={() => navigate('/')}
      />
    );
  }

  const theme = THEME_STYLES[project.theme] || THEME_STYLES.navy_gold;
  const sections = project.sections || {};
  const videoUrl = toVideoEmbedUrl(project.video?.url || sections.video?.url);
  const isAuthenticated = Boolean(accessToken && user);
  const isActiveInvestor =
    isAuthenticated &&
    user.status === USER_STATUSES.ACTIVE &&
    roles.some((r) => r.role === ROLES.INVESTOR);
  const canModerate =
    isAuthenticated &&
    roles.some((r) =>
      [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(r.role)
    );
  const hasVoted = Boolean(project.viewer?.hasVoted);

  async function handleVote() {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      await voteMutation.mutateAsync({ hasVoted });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleInvestorToggle(action, current, setter) {
    try {
      await investorAction.mutateAsync({ action, remove: current });
      setter(!current);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleContactSubmit(e) {
    e.preventDefault();
    try {
      await contactMutation.mutateAsync({ message: contactMessage });
      setContactOpen(false);
      setContactMessage('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const heroCoverUrl = sections.hero?.cover?.url || project.cover?.url;
  const layoutClass =
    project.template === 'modern'
      ? 'grid gap-6 lg:grid-cols-3'
      : project.template === 'minimal'
        ? 'mx-auto max-w-4xl space-y-6'
        : 'space-y-6';

  return (
    <div className="space-y-6">
      <Helmet title={`${project.title} — ${ar.common.platformName}`} />

      <header className={`overflow-hidden rounded-2xl shadow-sm ${theme.hero}`}>
        {heroCoverUrl && (
          <div className="aspect-[21/9] w-full overflow-hidden bg-navy-dark">
            <img src={heroCoverUrl} alt={project.title} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {project.field && <Badge tone="featured">{t(`projects.fields.${project.field}`)}</Badge>}
              {project.type && <Badge tone="info">{t(`projects.types.${project.type}`)}</Badge>}
            </div>
            <h1 className="text-2xl font-black sm:text-3xl">{project.title}</h1>
            {sections.hero?.slogan && (
              <p className={`text-sm font-bold sm:text-base ${theme.accent}`}>
                {sections.hero.slogan}
              </p>
            )}
            <p className="text-xs text-white/80">
              {project.college?.name} · {project.department?.name} ·{' '}
              <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
                {project.academicYearLabel}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="gold"
              onClick={handleVote}
              loading={voteMutation.isPending}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              <span>
                {isAuthenticated
                  ? hasVoted
                    ? ar.showcase.voted
                    : ar.showcase.vote
                  : ar.showcase.loginToVote}
              </span>
              <span className="rounded-full bg-navy/15 px-2 py-0.5 text-xs">
                {formatNumber(project.voteCount || 0)}
              </span>
            </Button>

            {isActiveInvestor && (
              <>
                <Button
                  variant="navy"
                  onClick={() => handleInvestorToggle('follow', following, setFollowing)}
                >
                  <Heart className="h-4 w-4" aria-hidden="true" />
                  <span>{following ? ar.showcase.unfollow : ar.showcase.follow}</span>
                </Button>
                <Button
                  variant="navy"
                  onClick={() => handleInvestorToggle('bookmark', bookmarked, setBookmarked)}
                >
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                  <span>{bookmarked ? ar.showcase.unbookmark : ar.showcase.bookmark}</span>
                </Button>
                <Button variant="outline" onClick={() => setContactOpen(true)}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span>{ar.showcase.contactTeam}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className={layoutClass}>
        <div className={project.template === 'modern' ? 'space-y-6 lg:col-span-2' : 'space-y-6'}>
          {sections.problem && (
            <Card title={ar.showcase.problemSection} className={theme.surface}>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                {sections.problem}
              </p>
            </Card>
          )}

          {sections.solution && (
            <Card title={ar.showcase.solutionSection} className={theme.surface}>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                {sections.solution}
              </p>
            </Card>
          )}

          {Array.isArray(sections.features) && sections.features.length > 0 && (
            <Card title={ar.showcase.featuresSection} className={theme.surface}>
              <ul className="list-disc space-y-1.5 ps-5 text-sm text-ink">
                {sections.features.map((feat, idx) => (
                  <li key={idx}>{feat}</li>
                ))}
              </ul>
            </Card>
          )}

          {videoUrl && (
            <Card title={ar.showcase.videoSection} className={theme.surface}>
              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-navy">
                <iframe
                  src={videoUrl}
                  title={project.title}
                  className="h-full w-full border-0"
                  allowFullScreen
                />
              </div>
            </Card>
          )}

          {Array.isArray(project.gallery) && project.gallery.length > 0 && (
            <Card title={ar.showcase.gallerySection} className={theme.surface}>
              <div className="grid gap-4 sm:grid-cols-2">
                {project.gallery.map((item) => {
                  const embed = toVideoEmbedUrl(item.link?.url);
                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-xl border border-line bg-white"
                    >
                      {item.url ? (
                        <div className="aspect-video w-full bg-navy">
                          <img
                            src={item.url}
                            alt={item.caption || project.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : embed ? (
                        <div className="aspect-video w-full bg-navy">
                          <iframe
                            src={embed}
                            title={item.caption || project.title}
                            className="h-full w-full border-0"
                            allowFullScreen
                          />
                        </div>
                      ) : null}
                      {item.caption && (
                        <p className="p-2.5 text-xs font-bold text-ink">{item.caption}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {Array.isArray(sections.technologies) && sections.technologies.length > 0 && (
            <Card title={ar.showcase.technologiesSection} className={theme.surface}>
              <div className="flex flex-wrap gap-2">
                {sections.technologies.map((tech, idx) => (
                  <Badge key={idx} tone="info">
                    {tech}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {Array.isArray(sections.components) && sections.components.length > 0 && (
            <Card title={ar.showcase.componentsSection} className={theme.surface}>
              <div className="flex flex-wrap gap-2">
                {sections.components.map((comp, idx) => (
                  <Badge key={idx} tone="neutral">
                    {comp}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {Array.isArray(project.achievements) && project.achievements.length > 0 && (
            <Card title={ar.showcase.achievementsSection} className={theme.surface}>
              <ul className="space-y-2 text-sm text-ink">
                {sections.achievements.map((ach, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                    <span>{ach}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {sections.interest && (
            <Card title={ar.showcase.interestSection} className={theme.surface}>
              <p className="whitespace-pre-line text-sm text-ink">{sections.interest}</p>
            </Card>
          )}

          <Card title={ar.showcase.teamSection} className={theme.surface}>
            <div className="space-y-3">
              {project.supervisor?.name && (
                <div className="rounded-xl bg-app-bg p-3 text-sm">
                  <p className="text-xs font-bold text-muted">{ar.showcase.supervisorLabel}</p>
                  <p className="font-bold text-navy">{project.supervisor.name}</p>
                </div>
              )}
              {(project.team || []).map((member, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl border border-line bg-white p-3"
                >
                  <Avatar src={member.avatar?.url} name={member.name} size="sm" />
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="font-bold text-navy">{member.name}</p>
                    {member.sharedContacts?.email && (
                      <p className="text-xs text-muted">
                        <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
                          {member.sharedContacts.email}
                        </span>
                      </p>
                    )}
                    {member.sharedContacts?.phone && (
                      <p className="text-xs text-muted">
                        <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
                          {member.sharedContacts.phone}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {project.college?.id && (
            <Link
              to={`/colleges/${project.college.id}/showcase`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-navy hover:bg-app-bg"
            >
              {ar.showcase.browseCollege}
            </Link>
          )}
        </div>
      </div>

      <CommentsSection
        projectId={project.id}
        slug={project.slug}
        isAuthenticated={isAuthenticated}
        canModerate={canModerate}
      />

      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title={ar.showcase.contactTeam}
      >
        <form onSubmit={handleContactSubmit} className="space-y-4">
          <Field label={ar.showcase.contactMessageLabel} required>
            <Textarea
              rows={4}
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setContactOpen(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="gold" loading={contactMutation.isPending}>
              {ar.showcase.sendContactRequest}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
