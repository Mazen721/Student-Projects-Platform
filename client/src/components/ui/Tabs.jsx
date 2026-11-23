export function Tabs({ items = [], value, onChange, className = '' }) {
  function handleKeyDown(event, index) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    // In RTL, ArrowLeft advances to the next tab and ArrowRight moves to the previous tab.
    const delta = event.key === 'ArrowLeft' ? 1 : -1;
    const nextIndex = (index + delta + items.length) % items.length;
    onChange?.(items[nextIndex].value);
  }

  return (
    <div
      role="tablist"
      className={`flex gap-2 overflow-x-auto border-b border-line pb-1 ${className}`}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange?.(item.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition cursor-pointer ${
              active
                ? 'bg-gold font-extrabold text-navy'
                : 'font-semibold text-muted hover:bg-slate-100 hover:text-navy'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
