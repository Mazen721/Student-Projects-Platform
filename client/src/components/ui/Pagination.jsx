import { ChevronLeft, ChevronRight } from 'lucide-react';
import ar, { t } from '@/locales/ar';
import { formatNumber } from '@/lib/format';
import { Button } from './Button';

export function Pagination({ page = 1, pages = 1, onPageChange }) {
  if (pages <= 1) return null;
  const label = t('common.pageOf', {
    page: formatNumber(page),
    pages: formatNumber(pages),
  });

  return (
    <nav
      aria-label={label}
      className="flex items-center justify-between gap-3 pt-4"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange?.(page - 1)}
        aria-label={ar.common.previousPage}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span>{ar.common.previous}</span>
      </Button>
      <span className="text-sm font-bold text-muted">{label}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPageChange?.(page + 1)}
        aria-label={ar.common.nextPage}
      >
        <span>{ar.common.next}</span>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
