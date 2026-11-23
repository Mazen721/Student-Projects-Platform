import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mswServer } from './setup';
import { useAuthStore } from '@/stores/authStore';
import ProposalFormPage from '@/features/projects/ProposalFormPage';
import ProjectsListPage from '@/features/projects/ProjectsListPage';
import SupervisorLoadPage from '@/features/projects/SupervisorLoadPage';
import IdeasBankPage from '@/features/projects/IdeasBankPage';

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

describe('Phase 4 Projects, Proposals, Supervision & Ideas UI Flows', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('shows live similar-title warning on ProposalFormPage without blocking save', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-stu',
      user: {
        id: 'stu1',
        name: 'أحمد الطالب',
        status: 'active',
        collegeId: 'c1',
        roles: [{ _id: 'r1', role: 'student' }],
      },
    });

    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    const pastDate = new Date(Date.now() - 86400000 * 5).toISOString();

    mswServer.use(
      http.get('*/api/v1/dashboard/home', () =>
        HttpResponse.json({
          data: {
            activeRole: 'student',
            userStatus: 'active',
            summary: {
              currentAcademicYear: {
                id: 'ay1',
                label: '2026/2027',
                cycle: {
                  registrationOpensAt: pastDate,
                  registrationClosesAt: futureDate,
                  proposalDeadline: futureDate,
                },
              },
            },
          },
        })
      ),
      http.get('*/api/v1/projects/similar-titles', () =>
        HttpResponse.json({
          data: [{ id: 'p-old', title: 'منصة الطاقة الشمسية الذكية', score: 0.85 }],
        })
      ),
      http.post('*/api/v1/projects', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ data: { id: 'p-new', ...body } }, { status: 201 });
      })
    );

    renderWithProviders(
      <Routes>
        <Route path="/app/projects/new" element={<ProposalFormPage />} />
        <Route path="/app/projects/:id" element={<div>تم إنشاء المقترح بنجاح</div>} />
      </Routes>,
      ['/app/projects/new']
    );

    fireEvent.change(screen.getByLabelText(/عنوان المشروع/), {
      target: { value: 'منصة الطاقة الشمسية المتقدمة' },
    });

    expect(await screen.findByText('توجد مشاريع بعناوين مشابهة في الجامعة')).toBeInTheDocument();
    expect(screen.getByText(/منصة الطاقة الشمسية الذكية/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/فكرة المشروع/), {
      target: { value: 'فكرة تفصيلية لمراقبة الطاقة الشمسية وتوفيرها' },
    });
    fireEvent.change(screen.getByLabelText(/المشكلة المستهدفة/), {
      target: { value: 'هدر الطاقة في المباني الجامعية بدون متابعة' },
    });
    fireEvent.change(screen.getByLabelText(/الأهداف/), {
      target: { value: 'تطوير لوحة قياس لحظية' },
    });
    fireEvent.change(screen.getByLabelText(/نطاق المشروع/), {
      target: { value: 'مباني الكلية الرئيسية' },
    });
    fireEvent.change(screen.getByLabelText(/الفئة المستفيدة/), {
      target: { value: 'إدارة الجامعة' },
    });
    fireEvent.change(screen.getByLabelText(/المخرجات المتوقعة/), {
      target: { value: 'نموذج أولي متكامل' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'حفظ المسودة' }));
    expect(await screen.findByText('تم إنشاء المقترح بنجاح')).toBeInTheDocument();
  });

  it('allows accepting a pending team invitation from ProjectsListPage', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-stu2',
      user: {
        id: 'stu2',
        name: 'سارة',
        status: 'active',
        roles: [{ _id: 'r2', role: 'student' }],
      },
    });

    let accepted = false;
    mswServer.use(
      http.get('*/api/v1/projects', () =>
        HttpResponse.json({
          data: [],
          page: { page: 1, limit: 12, total: 0, pages: 1 },
        })
      ),
      http.get('*/api/v1/me/team-invitations', () =>
        HttpResponse.json({
          data: [
            {
              id: 'inv1',
              project: { title: 'مشروع الروبوت الذكي' },
              invitedByUser: { name: 'أحمد' },
            },
          ],
        })
      ),
      http.post('*/api/v1/team-invitations/inv1/accept', () => {
        accepted = true;
        return HttpResponse.json({ data: { status: 'accepted', projectId: 'p1' } });
      })
    );

    renderWithProviders(
      <Routes>
        <Route path="/app/projects" element={<ProjectsListPage />} />
        <Route path="/app/projects/:id" element={<div>تفاصيل المشروع المنضم إليه</div>} />
      </Routes>,
      ['/app/projects']
    );

    expect(await screen.findByText('مشروع الروبوت الذكي')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'قبول الانضمام' }));
    await waitFor(() => expect(accepted).toBe(true));
    expect(await screen.findByText('تفاصيل المشروع المنضم إليه')).toBeInTheDocument();
  });

  it('prompts College Admin for mandatory overrideReason when assigning a full-capacity supervisor', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-cadmin',
      user: {
        id: 'ca1',
        name: 'عميد الكلية',
        status: 'active',
        collegeId: 'c1',
        roles: [{ _id: 'rc1', role: 'collegeAdmin', collegeId: 'c1' }],
      },
    });

    let submittedPayload = null;
    mswServer.use(
      http.get('*/api/v1/colleges', () =>
        HttpResponse.json({ data: [{ _id: 'c1', name: 'كلية الهندسة' }] })
      ),
      http.get('*/api/v1/colleges/c1/academic-years', () =>
        HttpResponse.json({ data: [{ _id: 'ay1', label: '2026/2027', isCurrent: true }] })
      ),
      http.get('*/api/v1/supervisors/load', () =>
        HttpResponse.json({
          data: [
            {
              supervisorId: 'sup1',
              name: 'د. محمد',
              primaryCount: 5,
              cap: 5,
              coCount: 1,
              remaining: 0,
              isFull: true,
            },
          ],
        })
      ),
      http.get('*/api/v1/projects', () =>
        HttpResponse.json({ data: [{ id: 'p1', title: 'مشروع ذكي' }] })
      ),
      http.put('*/api/v1/projects/p1/supervision', async ({ request }) => {
        submittedPayload = await request.json();
        return HttpResponse.json({ data: { id: 'p1' } });
      })
    );

    renderWithProviders(<SupervisorLoadPage />);

    expect((await screen.findAllByText('مكتمل النصاب')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/المشاريع/), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText(/المشرف الأساسي/), { target: { value: 'sup1' } });
    fireEvent.click(screen.getByRole('button', { name: 'تعيين الإشراف' }));

    expect(await screen.findByText(/يتطلب التعيين إدخال سبب موثق/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/سبب تجاوز الحد الأقصى للنصاب/, { selector: 'input' }), {
      target: { value: 'تخصص دقيق مطلوب للمشروع' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد' }));

    await waitFor(() => {
      expect(submittedPayload?.overrideReason).toBe('تخصص دقيق مطلوب للمشروع');
    });
  });

  it('allows investor to accept an adoption request on IdeasBankPage and redirects to prefilled draft', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-inv',
      user: {
        id: 'inv1',
        name: 'شركة التقنية',
        status: 'active',
        roles: [{ _id: 'ri1', role: 'investor' }],
      },
    });

    mswServer.use(
      http.get('*/api/v1/ideas', () =>
        HttpResponse.json({
          data: [
            {
              id: 'idea1',
              title: 'منصة تحليل الأشعة',
              description: 'وصف الفكرة',
              field: 'ai',
              ownerName: 'شركة التقنية',
            },
          ],
        })
      ),
      http.get('*/api/v1/me/adoption-requests', () =>
        HttpResponse.json({
          data: [{ id: 'req1', ideaTitle: 'منصة تحليل الأشعة', requesterName: 'أحمد الطالب' }],
        })
      ),
      http.post('*/api/v1/adoption-requests/req1/accept', () =>
        HttpResponse.json({
          data: { idea: { id: 'idea1', status: 'taken' }, project: { id: 'proj-adopted' } },
        })
      )
    );

    renderWithProviders(
      <Routes>
        <Route path="/app/ideas" element={<IdeasBankPage />} />
        <Route path="/app/projects/:id" element={<div>مسودة المشروع المتبنى</div>} />
      </Routes>,
      ['/app/ideas']
    );

    expect(await screen.findByText('طلبات تبني الأفكار')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'الموافقة وإنشاء مسودة' }));
    expect(await screen.findByText('مسودة المشروع المتبنى')).toBeInTheDocument();
  });
});
