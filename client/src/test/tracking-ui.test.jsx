import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mswServer } from './setup';
import { useAuthStore } from '@/stores/authStore';
import PhaseTemplatesPage from '@/features/tracking/PhaseTemplatesPage';
import { ProjectPhasesPage } from '@/features/tracking/ProjectPhasesPage';
import { KanbanBoardPage } from '@/features/tracking/KanbanBoardPage';
import { BomToolsPage } from '@/features/tracking/BomToolsPage';
import { MeetingsPage } from '@/features/tracking/MeetingsPage';

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

const sampleProject = {
  id: 'proj1',
  title: 'منصة إدارة الطاقة',
  status: 'approved',
  statusFlag: 'on_track',
  activeMemberIds: ['stu1'],
  supervisorIds: ['sup1'],
  supervision: { primaryId: 'sup1' },
  progress: { percent: 50 },
  budgetEstimate: 500,
};

describe('Phase 5 Tracking UI Flows', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('displays phase templates and opens creation modal with live 100% weight check', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-admin',
      user: { id: 'adm1', name: 'عميد', status: 'active', roles: [{ _id: 'r1', role: 'collegeAdmin' }] },
    });

    mswServer.use(
      http.get('*/api/v1/colleges/col1/phase-templates', () =>
        HttpResponse.json({
          data: [
            {
              id: 'tpl1',
              name: 'قالب 2026',
              isDefault: true,
              phases: [{ key: 'p1', name: 'التحليل', weight: 100, requiredDeliverables: [] }],
            },
          ],
        })
      )
    );

    renderWithProviders(
      <Routes>
        <Route path="/colleges/:collegeId/phase-templates" element={<PhaseTemplatesPage />} />
      </Routes>,
      ['/colleges/col1/phase-templates']
    );

    expect(await screen.findByText('قالب 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /قالب مراحل جديد/ }));
    expect(await screen.findByText(/مجموع الأوزان: 100%/)).toBeInTheDocument();
  });

  it('renders project phases, deliverables, and allows student link submission', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-stu',
      user: { id: 'stu1', name: 'سارة', status: 'active', roles: [{ _id: 'r1', role: 'student' }] },
    });

    let submitted = false;
    mswServer.use(
      http.get('*/api/v1/projects/proj1/phases', () =>
        HttpResponse.json({
          data: {
            progress: { percent: 0 },
            phases: [
              {
                id: 'ph1',
                name: 'المرحلة الأولى',
                weight: 100,
                percent: 0,
                dueDate: '2026-12-15T00:00:00.000Z',
                requiredCount: 1,
                forms: [],
                milestones: [],
                deliverables: [
                  {
                    id: 'd1',
                    title: 'تقرير المتطلبات',
                    dueDate: '2026-12-15T00:00:00.000Z',
                    latestStatus: submitted ? 'submitted' : 'none',
                  },
                ],
              },
            ],
          },
        })
      ),
      http.post('*/api/v1/projects/proj1/deliverables/d1/submissions', () => {
        submitted = true;
        return HttpResponse.json({ data: { id: 'sub1', version: 1, isLate: false } }, { status: 201 });
      })
    );

    renderWithProviders(<ProjectPhasesPage project={sampleProject} />);

    expect(await screen.findByText('تقرير المتطلبات')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /تسليم المخرج/ }));

    fireEvent.change(await screen.findByLabelText('الرابط (https://)'), {
      target: { value: 'https://github.com/mnu/spp' },
    });
    fireEvent.click(screen.getByRole('button', { name: /إضافة رابط/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /تسليم المخرج/ }).pop());

    await waitFor(() => expect(submitted).toBe(true));
  });

  it('renders Kanban columns and moves tasks via accessible column selector', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-stu',
      user: { id: 'stu1', name: 'سارة', status: 'active', roles: [{ _id: 'r1', role: 'student' }] },
    });

    let currentCol = 'todo';
    mswServer.use(
      http.get('*/api/v1/projects/proj1/tasks', () =>
        HttpResponse.json({
          data: {
            tasks: [{ id: 't1', title: 'بناء الواجهة', column: currentCol }],
            columns: {
              todo: currentCol === 'todo' ? [{ id: 't1', title: 'بناء الواجهة', column: 'todo' }] : [],
              in_progress: [],
              review: [],
              done: currentCol === 'done' ? [{ id: 't1', title: 'بناء الواجهة', column: 'done' }] : [],
            },
          },
        })
      ),
      http.patch('*/api/v1/tasks/t1', async ({ request }) => {
        const body = await request.json();
        currentCol = body.column;
        return HttpResponse.json({ data: { id: 't1', title: 'بناء الواجهة', column: currentCol } });
      })
    );

    renderWithProviders(<KanbanBoardPage project={sampleProject} />);
    expect(await screen.findByText('بناء الواجهة')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/نقل إلى/), { target: { value: 'done' } });
    await waitFor(() => expect(currentCol).toBe('done'));
  });

  it('displays BOM total budget and converts meeting action items to tasks', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-stu',
      user: { id: 'stu1', name: 'سارة', status: 'active', roles: [{ _id: 'r1', role: 'student' }] },
    });

    let converted = false;
    mswServer.use(
      http.get('*/api/v1/projects/proj1/bom', () =>
        HttpResponse.json({
          data: {
            items: [{ id: 'b1', item: 'مستشعر حرارة', quantity: 2, unitPrice: 250, status: 'needed' }],
            budgetEstimate: 500,
          },
        })
      ),
      http.get('*/api/v1/projects/proj1/tools', () => HttpResponse.json({ data: [] })),
      http.get('*/api/v1/projects/proj1/meetings', () =>
        HttpResponse.json({
          data: [
            {
              id: 'm1',
              date: '2026-11-20T10:00:00.000Z',
              createdByName: 'د. المشرف',
              notes: 'مراجعة أسبوعية',
              actionItems: [{ text: 'توثيق الدائرة', taskId: converted ? 'task99' : null }],
            },
          ],
        })
      ),
      http.post('*/api/v1/meetings/m1/action-items/0/to-task', () => {
        converted = true;
        return HttpResponse.json({ data: { id: 'task99', title: 'توثيق الدائرة' } }, { status: 201 });
      })
    );

    renderWithProviders(
      <>
        <BomToolsPage project={sampleProject} />
        <MeetingsPage project={sampleProject} />
      </>
    );

    expect((await screen.findAllByText(/500/)).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('توثيق الدائرة')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /تحويل لمهمة/ }));
    expect(await screen.findByText('تم التحويل لمهمة')).toBeInTheDocument();
  });
});
