import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import ar from '@/locales/ar';
import { Card, CardSkeleton, EmptyState, Field, Pagination, Select } from '@/components/ui';
import { PublicProjectCard } from './PublicProjectCard';
import { usePublicCollegeShowcaseQuery } from './showcaseApi';

export default function CollegeShowcasePage() {
  const { id } = useParams();
  const [sort, setSort] = useState('trending');
  const [page, setPage] = useState(1);

  const { data: res, isLoading } = usePublicCollegeShowcaseQuery(id, { sort, page, limit: 12 });
  const college = res?.data?.college;
  const items = res?.data?.items || [];
  const pageMeta = res?.page;

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <Helmet
        title={`${college?.name || ar.showcase.collegeShowcaseTitle} — ${ar.common.platformName}`}
      />

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold">
            {college?.name || ar.showcase.collegeShowcaseTitle}
          </h1>
          <p className="mt-1 text-sm text-gold-light">{ar.showcase.collegeShowcaseTitle}</p>
        </div>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
        >
          {ar.common.backHome}
        </Link>
      </header>

      <Card>
        <div className="mb-6 max-w-xs">
          <Field label={ar.showcase.sortBy}>
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              placeholder={false}
              options={[
                { value: 'trending', label: ar.showcase.sortTrending },
                { value: 'votes', label: ar.showcase.sortVotes },
                { value: 'recent', label: ar.showcase.sortRecent },
              ]}
            />
          </Field>
        </div>

        {items.length === 0 ? (
          <EmptyState title={ar.common.noData} />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((project) => (
                <PublicProjectCard key={project.id || project.slug} project={project} />
              ))}
            </div>
            {pageMeta && pageMeta.pages > 1 && (
              <Pagination
                page={pageMeta.page}
                pages={pageMeta.pages}
                onPageChange={setPage}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
