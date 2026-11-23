import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mswServer } from './setup';
import { useAuthStore } from '@/stores/authStore';
import PublicHomePage from '@/features/showcase/PublicHomePage';
import ProjectMiniSitePage from '@/features/showcase/ProjectMiniSitePage';
import { MiniSiteBuilderPage } from '@/features/showcase/MiniSiteBuilderPage';
import FlaggedVotesPage from '@/features/showcase/FlaggedVotesPage';
import InvestorWorkspacePage from '@/features/showcase/InvestorWorkspacePage';

function renderWithProviders(ui, initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe('Phase 8 Public Showcase, Voting & Investors UI Flows', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('renders PublicHomePage sections and college directory from public endpoints', async () => {
    mswServer.use(
      http.get('*/api/v1/public/home', () =>
        HttpResponse.json({
          data: {
            featured: [
              {
                id: 'p1',
                slug: 'smart-campus',
                title: 'نظام الحرم الذكي',
                idea: 'إرشاد ذكي داخل الجامعة',
                field: 'software_engineering',
                college: { id: 'c1', name: 'كلية الهندسة' },
                voteCount: 12,
                views7d: 45,
                isFeatured: true,
              },
            ],
            trending: [],
            mostVoted: [],
            colleges: [{ id: 'c1', name: 'كلية الهندسة' }],
          },
        })
      ),
      http.get('*/api/v1/public/projects', () =>
        HttpResponse.json({ data: [], page: { page: 1, pages: 1, total: 0 } })
      )
    );

    renderWithProviders(<PublicHomePage />);

    expect((await screen.findAllByText('نظام الحرم الذكي')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('كلية الهندسة').length).toBeGreaterThanOrEqual(1);
  });

  it('shows unavailable notice when a mini-site slug returns 404', async () => {
    mswServer.use(
      http.get('*/api/v1/public/projects/missing-slug', () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'غير موجود' } }, { status: 404 })
      )
    );

    renderWithProviders(
      <Routes>
        <Route path="/p/:slug" element={<ProjectMiniSitePage />} />
      </Routes>,
      ['/p/missing-slug']
    );

    expect(await screen.findByText('هذا المشروع غير متاح حالياً')).toBeInTheDocument();
  });

  it('renders published mini-site details, opt-in contacts, comments and triggers vote', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-student',
      user: {
        id: 'u2',
        name: 'طالب ناخب',
        status: 'active',
        roles: [{ _id: 'r1', role: 'student' }],
      },
    });

    let voted = false;
    mswServer.use(
      http.get('*/api/v1/public/projects/smart-campus', () =>
        HttpResponse.json({
          data: {
            id: 'p1',
            slug: 'smart-campus',
            title: 'نظام الحرم الذكي',
            field: 'ai',
            type: 'software',
            college: { id: 'c1', name: 'كلية الهندسة' },
            department: { id: 'd1', name: 'هندسة الحاسبات' },
            academicYearLabel: '2026/2027',
            template: 'modern',
            theme: 'navy_gold',
            sections: {
              hero: { slogan: 'مسار أذكى للطلاب' },
              problem: 'صعوبة الوصول للقاعات',
              solution: 'خرائط تفاعلية',
            },
            gallery: [],
            team: [
              {
                name: 'أحمد علي',
                sharedContacts: { email: 'ahmed@mnu.edu.eg' },
              },
            ],
            supervisor: { name: 'د. محمد حسن' },
            achievements: [],
            voteCount: voted ? 6 : 5,
            viewer: { hasVoted: voted, canVote: !voted },
          },
        })
      ),
      http.post('*/api/v1/public/projects/smart-campus/view', () => new HttpResponse(null, { status: 204 })),
      http.get('*/api/v1/public/projects/smart-campus/comments', () =>
        HttpResponse.json({ data: [], page: { page: 1, pages: 1, total: 0 } })
      ),
      http.post('*/api/v1/projects/p1/vote', () => {
        voted = true;
        return HttpResponse.json({ data: { status: 'valid', voteCount: 6 } }, { status: 201 });
      })
    );

    renderWithProviders(
      <Routes>
        <Route path="/p/:slug" element={<ProjectMiniSitePage />} />
      </Routes>,
      ['/p/smart-campus']
    );

    expect((await screen.findAllByText('نظام الحرم الذكي')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ahmed@mnu.edu.eg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /تصويت/ }));
    await waitFor(() => expect(voted).toBe(true));
  });

  it('allows team leader to save showcase settings and request publication', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-leader',
      user: {
        id: 'leader1',
        name: 'قائد الفريق',
        status: 'active',
        roles: [{ _id: 'r1', role: 'student' }],
      },
    });

    let requested = false;
    mswServer.use(
      http.get('*/api/v1/projects/p1/showcase', () =>
        HttpResponse.json({
          data: {
            id: 's1',
            projectId: 'p1',
            slug: 'smart-campus',
            state: requested ? 'pending_approval' : 'draft',
            everApproved: false,
            template: 'classic',
            theme: 'navy_gold',
            sections: { solution: 'حل ذكي' },
            hiddenSections: [],
          },
        })
      ),
      http.get('*/api/v1/projects/p1/contact-requests', () => HttpResponse.json({ data: [] })),
      http.post('*/api/v1/projects/p1/showcase/transitions', () => {
        requested = true;
        return HttpResponse.json({
          data: {
            id: 's1',
            projectId: 'p1',
            slug: 'smart-campus',
            state: 'pending_approval',
          },
        });
      })
    );

    renderWithProviders(
      <MiniSiteBuilderPage
        project={{ id: 'p1', team: { leaderId: 'leader1' }, activeMemberIds: ['leader1'] }}
      />
    );

    const publishBtn = await screen.findByRole('button', { name: /طلب اعتماد النشر/ });
    fireEvent.click(publishBtn);
    await waitFor(() => expect(requested).toBe(true));
  });

  it('displays flagged votes and allows admin to clear a vote', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-admin',
      user: {
        id: 'adm1',
        name: 'عميد الكلية',
        status: 'active',
        roles: [{ _id: 'r1', role: 'collegeAdmin' }],
      },
    });

    let reviewedDecision = null;
    mswServer.use(
      http.get('*/api/v1/votes/flagged', () =>
        HttpResponse.json({
          data: [
            {
              id: 'v1',
              projectId: 'p1',
              projectTitle: 'نظام الحرم الذكي',
              projectSlug: 'smart-campus',
              voterName: 'طالب ناخب',
              createdAt: '2026-11-23T12:00:00.000Z',
            },
          ],
          page: { page: 1, pages: 1, total: 1 },
        })
      ),
      http.post('*/api/v1/votes/v1/review', async ({ request }) => {
        const body = await request.json();
        reviewedDecision = body.decision;
        return HttpResponse.json({ data: { id: 'v1', status: 'cleared', voteCount: 4 } });
      })
    );

    renderWithProviders(<FlaggedVotesPage />);

    expect((await screen.findAllByText('نظام الحرم الذكي')).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getAllByRole('button', { name: /اعتماد الصوت/ })[0]);
    await waitFor(() => expect(reviewedDecision).toBe('clear'));
  });

  it('renders InvestorWorkspacePage contact replies and challenges', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-inv',
      user: {
        id: 'inv1',
        name: 'مستثمر',
        status: 'active',
        roles: [{ _id: 'r1', role: 'investor' }],
      },
    });

    mswServer.use(
      http.get('*/api/v1/me/follows', () => HttpResponse.json({ data: [] })),
      http.get('*/api/v1/me/bookmarks', () => HttpResponse.json({ data: [] })),
      http.get('*/api/v1/me/contact-requests', () =>
        HttpResponse.json({
          data: [
            {
              id: 'cr1',
              projectId: 'p1',
              project: { id: 'p1', title: 'نظام الحرم الذكي', slug: 'smart-campus' },
              message: 'نرغب في رعاية المشروع',
              state: 'accepted',
              reply: {
                text: 'مرحباً بكم',
                sharedContacts: { email: 'leader@mnu.edu.eg' },
              },
            },
          ],
        })
      ),
      http.get('*/api/v1/challenges', () =>
        HttpResponse.json({
          data: [
            {
              id: 'ch1',
              title: 'تحدي الطاقة النظيفة',
              description: 'حلول تقليل الاستهلاك',
              field: 'renewable_energy',
              investorName: 'مستثمر',
              createdAt: '2026-11-23T12:00:00.000Z',
            },
          ],
        })
      )
    );

    renderWithProviders(<InvestorWorkspacePage />);

    fireEvent.click(await screen.findByRole('tab', { name: /طلبات التواصل المرسلة/ }));
    expect(await screen.findByText('leader@mnu.edu.eg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /تحديات الصناعة/ }));
    expect(await screen.findByText('تحدي الطاقة النظيفة')).toBeInTheDocument();
  });
});
