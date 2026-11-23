import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import ar, { t } from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/format';
import { getSocket } from '@/lib/socket';
import { useUiStore } from '@/stores/uiStore';
import { Badge, Button, Card, CardSkeleton, EmptyState, Pagination } from '@/components/ui';
import {
  useMarkNotificationsReadMutation,
  useNotificationsQuery,
} from './collaborationApi';

export default function NotificationCenter() {
  const qc = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useNotificationsQuery({
    page,
    ...(unreadOnly ? { unread: 'true' } : {}),
  });
  const markReadMutation = useMarkNotificationsReadMutation();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    socket.on('notification:new', refresh);
    socket.on('notification:count', refresh);
    return () => {
      socket.off('notification:new', refresh);
      socket.off('notification:count', refresh);
    };
  }, [qc]);

  async function handleMarkAll() {
    try {
      await markReadMutation.mutateAsync({ all: true });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleMarkOne(id) {
    try {
      await markReadMutation.mutateAsync({ ids: [id] });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  const items = data?.data || [];
  const pageMeta = data?.page;
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.nav.notifications} — ${ar.common.platformName}`} />

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white">
        <div>
          <h1 className="text-2xl font-extrabold">{ar.nav.notifications}</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-gold-light">
              {t('chat.unreadBadge', { count: unreadCount })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={unreadOnly ? 'gold' : 'outline'}
            onClick={() => {
              setUnreadOnly((v) => !v);
              setPage(1);
            }}
          >
            {ar.common.filter}
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="gold"
              loading={markReadMutation.isPending}
              onClick={handleMarkAll}
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span>{ar.notifications.markAllRead}</span>
            </Button>
          )}
        </div>
      </header>

      {isLoading ? (
        <CardSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title={ar.notifications.empty} />
      ) : (
        <Card>
          <div className="divide-y divide-line">
            {items.map((notif) => (
              <div
                key={notif.id}
                className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                  !notif.readAt ? 'bg-[#f8fafc] px-3 rounded-xl' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-navy">{t(notif.titleKey)}</span>
                    {!notif.readAt && <Badge tone="featured">{ar.common.yes}</Badge>}
                  </div>
                  <p className="text-sm text-ink">{t(notif.bodyKey, notif.vars)}</p>
                  <p className="text-xs text-muted">{formatRelativeTime(notif.createdAt)}</p>
                </div>

                <div className="flex items-center gap-2">
                  {notif.link && (
                    <Link
                      to={notif.link}
                      onClick={() => !notif.readAt && handleMarkOne(notif.id)}
                      className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 py-2 text-xs font-bold text-navy hover:bg-app-bg"
                    >
                      {ar.common.details}
                    </Link>
                  )}
                  {!notif.readAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkOne(notif.id)}
                    >
                      {ar.common.confirm}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {pageMeta && pageMeta.pages > 1 && (
            <div className="mt-4">
              <Pagination page={pageMeta.page} pages={pageMeta.pages} onPageChange={setPage} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
