import { createBrowserRouter, Link, Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ar from '@/locales/ar';

function RootShell() {
  return (
    <div className="min-h-dvh bg-app-bg text-ink">
      <Helmet>
        <title>{ar.common.platformName}</title>
      </Helmet>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded-xl focus:bg-gold focus:px-4 focus:py-2 focus:font-bold focus:text-navy"
      >
        {ar.common.skipToContent}
      </a>
      <main id="main-content" className="mx-auto max-w-[80rem] px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

function HomePlaceholderPage() {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <header className="mb-4 rounded-xl bg-navy p-6 text-white">
        <h1 className="text-2xl font-extrabold">{ar.showcase.homeTitle}</h1>
        <p className="mt-2 text-sm text-gold-light">{ar.showcase.homeSubtitle}</p>
      </header>
      <p className="text-muted">{ar.common.universityName}</p>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-extrabold text-navy">{ar.common.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{ar.common.notFoundDescription}</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-gold px-5 py-2.5 font-extrabold text-navy transition hover:bg-gold-light"
      >
        {ar.common.backHome}
      </Link>
    </section>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootShell />,
    children: [
      { index: true, element: <HomePlaceholderPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
