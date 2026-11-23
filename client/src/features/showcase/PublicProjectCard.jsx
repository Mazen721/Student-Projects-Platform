import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Eye, ThumbsUp } from 'lucide-react';
import ar, { t } from '@/locales/ar';
import { formatNumber } from '@/lib/format';
import { Badge } from '@/components/ui';

export function PublicProjectCard({ project }) {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(project.cover?.url) && !imgError;

  return (
    <Link
      to={`/p/${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_3px_rgba(18,47,74,.05)] transition hover:border-navy/30"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-navy">
        {showImage ? (
          <img
            src={project.cover.url}
            alt={project.title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-l from-navy to-navy-dark text-3xl font-black text-gold">
            {(project.title || '').slice(0, 1)}
          </div>
        )}
        {project.isFeatured && (
          <span className="absolute top-3 start-3 inline-flex items-center gap-1 rounded-full bg-[#faf3d7] px-2.5 py-1 text-[0.72rem] font-extrabold text-[#7c5e0b]">
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{ar.showcase.featured}</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {project.field && <Badge tone="info">{t(`projects.fields.${project.field}`)}</Badge>}
            <span className="text-xs text-muted">{project.college?.name}</span>
          </div>
          <h3 className="line-clamp-2 text-base font-extrabold text-navy">{project.title}</h3>
          <p className="line-clamp-2 text-sm text-ink/85">{project.idea}</p>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3 text-xs font-bold text-muted">
          <span className="inline-flex items-center gap-1 text-navy">
            <ThumbsUp className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
            <span>{t('showcase.votesCount', { count: formatNumber(project.voteCount || 0) })}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('showcase.viewsCount', { count: formatNumber(project.views7d || 0) })}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
