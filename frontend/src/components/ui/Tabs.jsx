/** Underlined tab bar. Scrolls horizontally on narrow screens instead of wrapping. */
export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`scrollbar-thin -mx-1 overflow-x-auto ${className}`}>
      <div role="tablist" className="flex min-w-max gap-1 border-b border-stone-200 px-1">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? 'border-ink-700 text-ink-800' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.icon && <tab.icon className="h-4 w-4" aria-hidden />}
              {tab.label}
              {tab.count !== undefined && (
                <span className={`rounded-full px-1.5 text-xs tabular ${active ? 'bg-ink-100 text-ink-800' : 'bg-stone-100 text-stone-500'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
