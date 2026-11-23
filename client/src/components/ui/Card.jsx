export function Card({ title, subtitle, actions, children, className = '', padding = 'p-4 sm:p-5' }) {
  return (
    <section
      className={`rounded-2xl border border-line bg-white shadow-[0_1px_3px_rgba(18,47,74,0.05)] ${padding} ${className}`}
    >
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-extrabold text-navy">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
