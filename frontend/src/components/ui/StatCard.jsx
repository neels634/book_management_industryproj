import { Link } from 'react-router-dom';

const ACCENTS = {
  ink: 'bg-ink-50 text-ink-700',
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-sky-50 text-sky-700',
  red: 'bg-rose-50 text-rose-700',
  amber: 'bg-amber-50 text-amber-700',
  brass: 'bg-brass-50 text-brass-700',
};

export default function StatCard({ label, value, hint, icon: Icon, tone = 'ink', to, highlight = false }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ACCENTS[tone]}`}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
        )}
      </div>
      <p className={`mt-2 font-display text-3xl font-semibold tabular ${highlight ? 'text-rose-700' : 'text-stone-900'}`}>
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-xs text-stone-500">{hint}</p>}
    </>
  );
  const classes = 'card block p-4 sm:p-5 transition';
  return to ? (
    <Link to={to} className={`${classes} hover:border-ink-300 hover:shadow-lifted`}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
