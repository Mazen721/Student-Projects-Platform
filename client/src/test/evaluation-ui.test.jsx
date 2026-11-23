import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mswServer } from './setup';
import { useAuthStore } from '@/stores/authStore';
import RubricsPage from '@/features/evaluation/RubricsPage';
import { ProjectDefensePanel } from '@/features/evaluation/DefenseSchedulingPage';
import GradingWorkspacePage from '@/features/evaluation/GradingWorkspacePage';
import { StudentGradePage } from '@/features/evaluation/StudentGradePage';

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

describe('Phase 7 Evaluation & Defense UI Flows', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('displays college rubrics and validates 100% weights & split in modal', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-adm',
      user: { id: 'adm1', name: 'عميد', status: 'active', roles: [{ _id: 'r1', role: 'collegeAdmin' }] },
    });

    mswServer.use(
      http.get('*/api/v1/colleges/col1/academic-years', () =>
        HttpResponse.json({ data: [{ id: 'ay1', label: '2026/2027', isCurrent: true }] })
      ),
      http.get('*/api/v1/colleges/col1/rubrics', () =>
        HttpResponse.json({
          data: [
            {
              id: 'rub1',
              name: 'نموذج 2026',
              supervisorPct: 40,
              committeePct: 60,
              status: 'active',
              criteria: [{ key: 'c1', name: 'التصميم', weight: 100, appliesTo: 'team' }],
            },
          ],
        })
      )
    );

    renderWithProviders(
      <Routes>
        <Route path="/colleges/:collegeId/rubrics" element={<RubricsPage />} />
      </Routes>,
      ['/colleges/col1/rubrics']
    );

    expect(await screen.findByText('نموذج 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /إنشاء نموذج تقييم/ }));
    expect(await screen.findByText(/مجموع أوزان المعايير: 100%/)).toBeInTheDocument();
  });

  it('renders defense eligibility and primary supervisor sign-off button', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-sup',
      user: { id: 'sup1', name: 'مشرف', status: 'active', roles: [{ _id: 'r1', role: 'supervisor' }] },
    });

    mswServer.use(
      http.get('*/api/v1/projects/p1/defense/eligibility', () =>
        HttpResponse.json({
          data: {
            eligible: false,
            allPhasesApproved: true,
            signedOff: false,
            defenseState: 'not_eligible',
            missingPhases: [],
          },
        })
      )
    );

    renderWithProviders(
      <ProjectDefensePanel project={{ id: 'p1', supervision: { primaryId: 'sup1' } }} />
    );

    expect(await screen.findByRole('button', { name: /اعتماد الجاهزية للمناقشة/ })).toBeInTheDocument();
  });

  it('shows spread warning and chair deliberation/finalize controls when all examiners submit', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-chair',
      user: { id: 'ch1', name: 'رئيس اللجنة', status: 'active', roles: [{ _id: 'r1', role: 'committeeMember' }] },
    });

    mswServer.use(
      http.get('*/api/v1/defenses/def1', () =>
        HttpResponse.json({
          data: {
            id: 'def1',
            projectTitle: 'منصة الطاقة الذكية',
            state: 'grading',
            scheduledAt: '2027-05-20T10:00:00.000Z',
            chairId: 'ch1',
            supervisorId: 'sup1',
            examinerIds: ['ch1', 'ex2'],
            submittedCount: 3,
            totalExaminers: 3,
            spreadFlag: { deliberationCount: 0 },
          },
        })
      ),
      http.get('*/api/v1/defenses/def1/my-scoresheet', () =>
        HttpResponse.json({
          data: {
            rubric: { criteria: [{ key: 'c1', name: 'التصميم', weight: 100, appliesTo: 'team' }] },
            students: [{ id: 's1', name: 'أحمد' }],
            myScore: { teamScores: { c1: 70 }, individualScores: {}, submittedAt: '2027-05-20T10:15:00Z' },
          },
        })
      ),
      http.get('*/api/v1/defenses/def1/scores', () =>
        HttpResponse.json({
          data: {
            spreadExceeded: true,
            maxSpread: 20,
            students: [{ id: 's1', name: 'أحمد' }],
            examiners: [
              { examinerId: 'ch1', name: 'رئيس اللجنة', component: 'committee', totals: { s1: 70 } },
              { examinerId: 'ex2', name: 'ممتحن 2', component: 'committee', totals: { s1: 90 } },
            ],
          },
        })
      )
    );

    renderWithProviders(
      <Routes>
        <Route path="/defenses/:id/grading" element={<GradingWorkspacePage />} />
      </Routes>,
      ['/defenses/def1/grading']
    );

    expect(await screen.findByText(/يوجد تباين كبير بين درجات أعضاء اللجنة/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /فتح جولة مداولة للمراجعة/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /اعتماد الدرجات النهائية/ })).toBeInTheDocument();
  });

  it('displays only student own finalized grade, certificate button, and re-evaluation modal', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-stu',
      user: { id: 's1', name: 'أحمد', status: 'active', roles: [{ _id: 'r1', role: 'student' }] },
    });

    mswServer.use(
      http.get('*/api/v1/projects/p1/grades', () =>
        HttpResponse.json({
          data: {
            finalized: true,
            defenseState: 'finalized',
            finalizedAt: '2027-05-21T12:00:00.000Z',
            myGrade: {
              studentId: 's1',
              studentName: 'أحمد',
              final: 80,
              teamGrade: 80,
              supervisorTotal: 80,
              committeeAvg: 80,
              passed: true,
              band: 'veryGood',
              bandLabel: 'جيد جداً',
              perCriterion: [{ key: 'c1', name: 'التصميم', weight: 100, supervisor: 80, committeeAvg: 80 }],
            },
          },
        })
      )
    );

    renderWithProviders(
      <StudentGradePage project={{ id: 'p1', supervision: { primaryId: 'sup1' } }} />
    );

    expect(await screen.findByText('جيد جداً')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تحميل شهادة النتيجة/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /طلب إعادة التقييم/ }));
    expect(await screen.findByLabelText(/أسباب ومبررات طلب إعادة التقييم/)).toBeInTheDocument();
  });
});
