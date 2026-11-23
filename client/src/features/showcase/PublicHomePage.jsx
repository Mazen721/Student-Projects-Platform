import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Building2, Search, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { PROJECT_FIELD_VALUES, PROJECT_TYPE_VALUES } from '@spp/shared/constants';
import ar, { t } from '@/locales/ar';
import {
  Card,
  CardSkeleton,
  EmptyState,
  Field,
  Input,
  Pagination,
  Select,
} from '@/components/ui';
import { PublicProjectCard } from './PublicProjectCard';
import { usePublicHomeQuery, usePublicProjectsQuery } from './showcaseApi';

function ProjectSection({ title, icon: Icon, items = [] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-gold" aria-hidden="true" />
        <h2 className="text-lg font-extrabold text-navy">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((project) => (
          <PublicProjectCard key={project.id || project.slug} project={project} />
        ))}
      </div>
    </section>
  );
}

export default function PublicHomePage() {
  const [filters, setFilters] = useState({
    q: '',
    collegeId: '',
    field: '',
    type: '',
    sort: 'trending',
    page: 1,
  });

  const { data: home, isLoading: homeLoading } = usePublicHomeQuery();
  const { data: listRes, isLoading: listLoading } = usePublicProjectsQuery({
    page: filters.page,
    limit: 12,
    sort: filters.sort,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.collegeId ? { collegeId: filters.collegeId } : {}),
    ...(filters.field ? { field: filters.field } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  });

  const colleges = home?.colleges || [];
  const items = listRes?.data || [];
  const pageMeta = listRes?.page;
  const isFiltering = Boolean(filters.q || filters.collegeId || filters.field || filters.type);

  return (
    <div className="space-y-8">
      <Helmet title={`${ar.showcase.homeTitle} — ${ar.common.platformName}`} />

      <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-dark p-6 text-white shadow-sm sm:p-8">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-2xl font-black sm:text-3xl">{ar.showcase.homeTitle}</h1>
          <p className="text-sm text-gold-light sm:text-base">{ar.showcase.homeSubtitle}</p>
        </div>
      </header>

      {homeLoading ? (
        <CardSkeleton />
      ) : (
        !isFiltering && (
          <div className="space-y-8">
            <ProjectSection
              title={ar.showcase.featured}
              icon={Sparkles}
              items={home?.featured || []}
            />
            <ProjectSection
              title={ar.showcase.trending}
              icon={TrendingUp}
              items={home?.trending || []}
            />
            <ProjectSection
              title={ar.showcase.mostVoted}
              icon={Trophy}
              items={home?.mostVoted || []}
            />

            {colleges.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-navy" aria-hidden="true" />
                  <h2 className="text-lg font-extrabold text-navy">
                    {ar.showcase.collegesDirectory}
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {colleges.map((college) => (
                    <Link
                      key={college.id}
                      to={`/colleges/${college.id}/showcase`}
                      className="flex min-h-11 items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-navy transition hover:border-gold hover:bg-app-bg"
                    >
                      <span className="truncate">{college.name}</span>
                      <span className="text-xs font-extrabold text-gold">
                        {ar.showcase.browseCollege}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )
      )}

      <Card title={ar.showcase.allProjects}>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field id="home-search" label={ar.common.search}>
            <div className="relative">
              <Input
                id="home-search"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
                placeholder={ar.showcase.searchPlaceholder}
                className="ps-9"
              />
              <Search
                className="pointer-events-none absolute top-3.5 start-3 h-4 w-4 text-muted"
                aria-hidden="true"
              />
            </div>
          </Field>

          <Field id="home-college" label={ar.auth.college}>
            <Select
              id="home-college"
              value={filters.collegeId}
              onChange={(e) => setFilters((f) => ({ ...f, collegeId: e.target.value, page: 1 }))}
              placeholder={ar.common.all}
              options={colleges.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>

          <Field id="home-field" label={ar.projects.field}>
            <Select
              id="home-field"
              value={filters.field}
              onChange={(e) => setFilters((f) => ({ ...f, field: e.target.value, page: 1 }))}
              placeholder={ar.common.all}
              options={PROJECT_FIELD_VALUES.map((v) => ({
                value: v,
                label: t(`projects.fields.${v}`),
              }))}
            />
          </Field>

          <Field id="home-type" label={ar.projects.type}>
            <Select
              id="home-type"
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
              placeholder={ar.common.all}
              options={PROJECT_TYPE_VALUES.map((v) => ({
                value: v,
                label: t(`projects.types.${v}`),
              }))}
            />
          </Field>

          <Field id="home-sort" label={ar.showcase.sortBy}>
            <Select
              id="home-sort"
              value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value, page: 1 }))}
              placeholder={false}
              options={[
                { value: 'trending', label: ar.showcase.sortTrending },
                { value: 'votes', label: ar.showcase.sortVotes },
                { value: 'recent', label: ar.showcase.sortRecent },
              ]}
            />
          </Field>
        </div>

        {listLoading ? (
          <CardSkeleton />
        ) : items.length === 0 ? (
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
                onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
