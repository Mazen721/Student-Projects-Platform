import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import ar from '@/locales/ar';
import { useAuthStore } from '@/stores/authStore';
import ProjectChatPage from '@/features/collaboration/ProjectChatPage';
import { CommentThread } from '@/features/collaboration/CommentThread';
import NotificationCenter from '@/features/collaboration/NotificationCenter';
import AnnouncementsPage from '@/features/collaboration/AnnouncementsPage';
import { MediaGalleryPage } from '@/features/collaboration/MediaGalleryPage';
import { mswServer } from './setup';

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

const sampleProject = {
  id: 'proj1',
  title: 'نظام ذكي للمواصلات',
  status: 'approved',
  activeMemberIds: ['stu1'],
  supervision: { primaryId: 'sup1' },
  teamMembers: [{ userId: 'stu1', name: 'سارة' }],
  supervisionDetails: { primary: { id: 'sup1', name: 'د. محمد' }, coSupervisors: [], mentors: [] },
};

describe('Phase 6 Collaboration UI Flows', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('hides team_only channels from supervisors and displays messages with removed tombstone', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-sup',
      user: { id: 'sup1', name: 'د. محمد', status: 'active', roles: [{ _id: 'r1', role: 'supervisor' }] },
    });

    mswServer.use(
      http.get('*/api/v1/projects/proj1/channels', () =>
        HttpResponse.json({
          data: [
            {
              id: 'ch-group',
              kind: 'project_group',
              title: 'نظام ذكي للمواصلات',
              members: [
                { id: 'stu1', name: 'سارة' },
                { id: 'sup1', name: 'د. محمد' },
              ],
              unreadCount: 1,
            },
            {
              id: 'ch-team',
              kind: 'team_only',
              title: 'نظام ذكي للمواصلات',
              members: [{ id: 'stu1', name: 'سارة' }],
              unreadCount: 0,
            },
          ],
        })
      ),
      http.get('*/api/v1/channels/ch-group/messages', () =>
        HttpResponse.json({
          data: [
            {
              id: 'm2',
              channelId: 'ch-group',
              senderId: 'stu1',
              sender: { id: 'stu1', name: 'سارة' },
              text: ar.chat.removedByAdmin,
              isRemoved: true,
              attachments: [],
              readBy: [],
              createdAt: new Date().toISOString(),
            },
            {
              id: 'm1',
              channelId: 'ch-group',
              senderId: 'stu1',
              sender: { id: 'stu1', name: 'سارة' },
              text: 'أهلاً دكتور',
              isRemoved: false,
              attachments: [],
              readBy: [],
              createdAt: new Date().toISOString(),
            },
          ],
        })
      ),
      http.post('*/api/v1/channels/ch-group/read', () => new HttpResponse(null, { status: 204 }))
    );

    renderWithProviders(<ProjectChatPage project={sampleProject} />);

    expect(await screen.findByText('أهلاً دكتور')).toBeInTheDocument();
    expect(screen.getByText(ar.chat.removedByAdmin)).toBeInTheDocument();
    expect(screen.queryByText(ar.chat.teamOnly)).not.toBeInTheDocument();
  });

  it('renders comment thread and posts a new comment', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-stu',
      user: { id: 'stu1', name: 'سارة', status: 'active', roles: [{ _id: 'r1', role: 'student' }] },
    });

    const comments = [
      {
        id: 'c1',
        authorId: 'sup1',
        author: { id: 'sup1', name: 'د. محمد' },
        text: 'ملاحظة أولى',
        isRemoved: false,
        createdAt: new Date().toISOString(),
      },
    ];

    mswServer.use(
      http.get('*/api/v1/comments', () => HttpResponse.json({ data: comments })),
      http.post('*/api/v1/comments', async ({ request }) => {
        const body = await request.json();
        const next = {
          id: 'c2',
          authorId: 'stu1',
          author: { id: 'stu1', name: 'سارة' },
          text: body.text,
          isRemoved: false,
          createdAt: new Date().toISOString(),
        };
        comments.push(next);
        return HttpResponse.json({ data: next }, { status: 201 });
      })
    );

    renderWithProviders(<CommentThread targetType="deliverable" targetId="deliv1" />);
    expect(await screen.findByText('ملاحظة أولى')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(ar.chat.addCommentPlaceholder), {
      target: { value: 'تم التحديث' },
    });
    fireEvent.click(screen.getByRole('button', { name: ar.chat.send }));

    expect(await screen.findByText('تم التحديث')).toBeInTheDocument();
  });

  it('renders notifications, marks all as read, and displays scoped announcements', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-stu',
      user: { id: 'stu1', name: 'سارة', status: 'active', roles: [{ _id: 'r1', role: 'student' }] },
    });

    let unreadCount = 1;
    mswServer.use(
      http.get('*/api/v1/notifications', () =>
        HttpResponse.json({
          data: [
            {
              id: 'n1',
              type: 'chat_mention',
              titleKey: 'chat.projectGroup',
              bodyKey: 'notifications.mentionedInChat',
              vars: { project: 'المواصلات' },
              link: '/app/chat',
              readAt: unreadCount === 0 ? new Date().toISOString() : null,
              createdAt: new Date().toISOString(),
            },
          ],
          page: { page: 1, limit: 20, total: 1, pages: 1 },
          unreadCount,
        })
      ),
      http.post('*/api/v1/notifications/read', () => {
        unreadCount = 0;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('*/api/v1/announcements', () =>
        HttpResponse.json({
          data: [
            {
              id: 'a1',
              authorName: 'د. محمد',
              title: 'موعد التسليم القادم',
              body: 'يرجى المراجعة قبل الخميس',
              audienceCount: 3,
              createdAt: new Date().toISOString(),
            },
          ],
          page: { page: 1, limit: 20, total: 1, pages: 1 },
        })
      ),
      http.get('*/api/v1/colleges', () => HttpResponse.json({ data: [] }))
    );

    renderWithProviders(<NotificationCenter />);
    expect(await screen.findByText(/المواصلات/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ar.notifications.markAllRead }));

    renderWithProviders(<AnnouncementsPage />);
    expect(await screen.findByText('موعد التسليم القادم')).toBeInTheDocument();
  });

  it('renders project media gallery albums and toggles item visibility', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-stu',
      user: { id: 'stu1', name: 'سارة', status: 'active', roles: [{ _id: 'r1', role: 'student' }] },
    });

    let visibility = 'private';
    mswServer.use(
      http.get('*/api/v1/projects/proj1/albums', () =>
        HttpResponse.json({
          data: [
            {
              id: 'alb1',
              title: 'صور النموذج',
              items: [
                {
                  id: 'item1',
                  kind: 'video_link',
                  link: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
                  caption: 'فيديو العرض',
                  visibility,
                },
              ],
            },
          ],
        })
      ),
      http.patch('*/api/v1/media-items/item1', async ({ request }) => {
        const body = await request.json();
        visibility = body.visibility;
        return HttpResponse.json({ data: { id: 'item1', visibility } });
      })
    );

    renderWithProviders(<MediaGalleryPage project={sampleProject} />);
    expect(await screen.findByText('صور النموذج')).toBeInTheDocument();
    expect(screen.getByText(ar.chat.visibilityPrivate)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: ar.chat.toggleVisibility }));
    expect(await screen.findByText(ar.chat.visibilityPublic)).toBeInTheDocument();
  });
});
