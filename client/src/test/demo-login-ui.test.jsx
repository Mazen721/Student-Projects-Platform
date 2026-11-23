import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mswServer } from './setup';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/features/auth/LoginPage';

function renderLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<div>لوحة التحكم</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe('Demo quick-login UI', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('hides the demo section when the server has demo login disabled (404)', async () => {
    mswServer.use(
      http.get('*/api/v1/auth/demo-login', () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
      )
    );

    renderLogin();

    // Login form renders normally
    expect(await screen.findByRole('button', { name: 'دخول' })).toBeInTheDocument();
    expect(screen.queryByText('دخول سريع للعرض التجريبي')).not.toBeInTheDocument();
  });

  it('renders one button per demo account and signs in on click', async () => {
    let postedAccount = null;
    mswServer.use(
      http.get('*/api/v1/auth/demo-login', () =>
        HttpResponse.json({
          data: {
            accounts: [
              { key: 'student_one', title: 'طالبة — قائدة فريق' },
              { key: 'student_two', title: 'طالب — عضو بنفس الفريق' },
              { key: 'visitor', title: 'زائرة' },
            ],
          },
        })
      ),
      http.post('*/api/v1/auth/demo-login', async ({ request }) => {
        const body = await request.json();
        postedAccount = body.account;
        return HttpResponse.json({
          data: {
            accessToken: 'tok-demo',
            mustChangePassword: false,
            user: {
              id: 'u-youssef',
              name: 'يوسف أحمد عبد الله',
              email: 'youssef.ahmed@mnu.edu.eg',
              status: 'active',
              roles: [],
            },
          },
        });
      })
    );

    renderLogin();

    const button = await screen.findByRole('button', { name: 'طالب — عضو بنفس الفريق' });
    expect(screen.getByRole('button', { name: 'طالبة — قائدة فريق' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'زائرة' })).toBeInTheDocument();

    fireEvent.click(button);

    expect(await screen.findByText('لوحة التحكم')).toBeInTheDocument();
    expect(postedAccount).toBe('student_two');
    expect(useAuthStore.getState().accessToken).toBe('tok-demo');
    expect(useAuthStore.getState().user.email).toBe('youssef.ahmed@mnu.edu.eg');
  });
});
