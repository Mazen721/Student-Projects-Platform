import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mswServer } from './setup';
import { api, setSessionExpiredHandler } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Modal, Pagination, ProgressBar, ResponsiveTable } from '@/components/ui';
import { AppLayout } from '@/layouts/AppLayout';
import { RequireAuth } from '@/routes/guards';

describe('Axios Single-Flight Refresh Interceptor', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    setSessionExpiredHandler(null);
  });

  it('queues concurrent 401 requests behind a single /auth/refresh call and replays them', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'expired-token',
      user: { id: 'u1', name: 'سارة', roles: [] },
    });

    let refreshCalls = 0;
    mswServer.use(
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json({
          data: {
            accessToken: 'fresh-token',
            user: { id: 'u1', name: 'سارة', roles: [] },
          },
        });
      }),
      http.get('*/api/v1/test-resource-a', ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer fresh-token') {
          return HttpResponse.json({ error: { code: 'TOKEN_EXPIRED' } }, { status: 401 });
        }
        return HttpResponse.json({ data: 'ok-a' });
      }),
      http.get('*/api/v1/test-resource-b', ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer fresh-token') {
          return HttpResponse.json({ error: { code: 'TOKEN_EXPIRED' } }, { status: 401 });
        }
        return HttpResponse.json({ data: 'ok-b' });
      })
    );

    const [resA, resB] = await Promise.all([
      api.get('/test-resource-a'),
      api.get('/test-resource-b'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(resA.data.data).toBe('ok-a');
    expect(resB.data.data).toBe('ok-b');
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
  });

  it('clears session and invokes expired handler when refresh fails', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'expired-token',
      user: { id: 'u1', name: 'سارة', roles: [] },
    });

    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    mswServer.use(
      http.post('*/api/v1/auth/refresh', () =>
        HttpResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 })
      ),
      http.get('*/api/v1/test-protected', () =>
        HttpResponse.json({ error: { code: 'TOKEN_EXPIRED' } }, { status: 401 })
      )
    );

    await expect(api.get('/test-protected')).rejects.toBeDefined();
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('RTL UI Kit & Layouts', () => {
  it('renders ProgressBar with Arabic percent and aria progressbar attributes', () => {
    render(<ProgressBar value={75} label="نسبة الإنجاز" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '75');
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders ResponsiveTable rows and empty state', () => {
    const columns = [
      { key: 'title', header: 'العنوان' },
      { key: 'status', header: 'الحالة' },
    ];
    const { rerender } = render(
      <ResponsiveTable
        columns={columns}
        rows={[{ id: '1', title: 'مشروع ذكي', status: 'معتمد' }]}
      />
    );
    expect(screen.getAllByText('مشروع ذكي').length).toBeGreaterThan(0);

    rerender(<ResponsiveTable columns={columns} rows={[]} emptyMessage="لا توجد مشاريع" />);
    expect(screen.getByText('لا توجد مشاريع')).toBeInTheDocument();
  });

  it('triggers Pagination page change and closes Modal on Escape', () => {
    const onPageChange = vi.fn();
    const onClose = vi.fn();
    render(
      <>
        <Pagination page={2} pages={5} onPageChange={onPageChange} />
        <Modal open onClose={onClose} title="تفاصيل">
          <p>محتوى</p>
        </Modal>
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: 'الصفحة التالية' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('redirects mustChangePassword users and opens More drawer in AppLayout', () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok',
      user: {
        id: 'u1',
        name: 'أحمد علي',
        mustChangePassword: true,
        roles: [{ _id: 'r1', role: 'student' }],
      },
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/change-password" element={<div>تغيير كلمة المرور</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/app" element={<div>الداخل</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('تغيير كلمة المرور')).toBeInTheDocument();
    unmount();

    useAuthStore.getState().setSession({
      accessToken: 'tok',
      user: {
        id: 'u1',
        name: 'أحمد علي',
        mustChangePassword: false,
        roles: [{ _id: 'r1', role: 'student' }],
      },
    });

    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<AppLayout unreadCount={3} />}>
            <Route index element={<div>محتوى الرئيسية</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'المزيد' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
