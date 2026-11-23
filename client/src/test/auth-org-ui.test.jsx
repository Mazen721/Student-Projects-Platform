import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mswServer } from './setup';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import HomeDashboardPage from '@/features/organization/HomeDashboardPage';

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

describe('Phase 3 Auth & Organization UI Flows', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('redirects temporary-password logins to /change-password and displays Arabic API errors', async () => {
    mswServer.use(
      http.post('*/api/v1/auth/login', async ({ request }) => {
        const body = await request.json();
        if (body.password === 'Wrong123') {
          return HttpResponse.json(
            { error: { code: 'INVALID_CREDENTIALS', message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' } },
            { status: 401 }
          );
        }
        return HttpResponse.json({
          data: {
            accessToken: 'tok-temp',
            mustChangePassword: true,
            user: { id: 'u1', name: 'سارة', status: 'active', roles: [] },
          },
        });
      })
    );

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<div>صفحة تغيير كلمة المرور</div>} />
      </Routes>,
      ['/login']
    );

    fireEvent.change(screen.getByLabelText(/البريد الإلكتروني/), {
      target: { value: 'sara@mnu.edu.eg' },
    });
    fireEvent.change(screen.getByLabelText(/كلمة المرور/), {
      target: { value: 'Wrong123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'دخول' }));

    expect(await screen.findByText('البريد الإلكتروني أو كلمة المرور غير صحيحة')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/كلمة المرور/), {
      target: { value: 'Temp1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'دخول' }));

    expect(await screen.findByText('صفحة تغيير كلمة المرور')).toBeInTheDocument();
  });

  it('loads colleges and departments on student registration tab and switches to investor tab', async () => {
    mswServer.use(
      http.get('*/api/v1/public/colleges', () =>
        HttpResponse.json({ data: [{ _id: 'c1', name: 'كلية الهندسة', code: 'ENG' }] })
      ),
      http.get('*/api/v1/public/colleges/c1/departments', () =>
        HttpResponse.json({ data: [{ _id: 'd1', name: 'هندسة الحاسبات', code: 'CE' }] })
      )
    );

    renderWithProviders(<RegisterPage />);

    expect(await screen.findByRole('option', { name: 'كلية الهندسة' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/الكلية/), { target: { value: 'c1' } });
    expect(await screen.findByRole('option', { name: 'هندسة الحاسبات' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'تسجيل مستثمر / شريك صناعي' }));
    expect(screen.getByLabelText(/جهة العمل \/ الشركة/)).toBeInTheDocument();
  });

  it('switches role context via RoleSwitcher on HomeDashboardPage and shows pending notice for pending investor', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok-multi',
      user: {
        id: 'u-multi',
        name: 'د. خالد',
        status: 'active',
        roles: [
          { _id: 'role-sup', role: 'supervisor' },
          { _id: 'role-dept', role: 'departmentAdmin' },
        ],
      },
    });

    const seenHeaders = [];
    mswServer.use(
      http.get('*/api/v1/dashboard/home', ({ request }) => {
        const ctx = request.headers.get('x-role-context');
        seenHeaders.push(ctx);
        return HttpResponse.json({
          data: {
            activeRole: ctx === 'role-dept' ? 'departmentAdmin' : 'supervisor',
            userStatus: 'active',
            summary: { collegesCount: 2, departmentsCount: 4, totalUsers: 50, pendingInvestors: 0 },
          },
        });
      })
    );

    const { unmount } = renderWithProviders(<HomeDashboardPage />);

    expect((await screen.findAllByText('مشرف')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('الدور النشط'), { target: { value: 'role-dept' } });

    await waitFor(() => {
      expect(seenHeaders).toContain('role-dept');
    });
    unmount();

    useAuthStore.getState().setSession({
      accessToken: 'tok-inv',
      user: {
        id: 'u-inv',
        name: 'مستثمر معلق',
        status: 'pending',
        roles: [{ _id: 'role-inv', role: 'investor' }],
      },
    });
    mswServer.use(
      http.get('*/api/v1/dashboard/home', () =>
        HttpResponse.json({
          data: {
            activeRole: 'investor',
            userStatus: 'pending',
            summary: { collegesCount: 2, departmentsCount: 4, totalUsers: 50, pendingInvestors: 0 },
          },
        })
      )
    );

    renderWithProviders(<HomeDashboardPage />);
    expect(await screen.findByText('حسابك كمستثمر قيد المراجعة من إدارة الجامعة.')).toBeInTheDocument();
  });
});
