import { STATUS_META } from '../../utils/constants';

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  stone: 'bg-stone-100 text-stone-600 ring-stone-500/20',
  ink: 'bg-ink-50 text-ink-700 ring-ink-600/20',
  brass: 'bg-brass-50 text-brass-800 ring-brass-600/25',
};

const DOTS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  blue: 'bg-sky-500',
  stone: 'bg-stone-400',
  ink: 'bg-ink-500',
  brass: 'bg-brass-500',
};

export function Badge({ tone = 'stone', dot = false, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} aria-hidden />}
      {children}
    </span>
  );
}

/** Badge for any API status value (ACTIVE, OVERDUE, PENDING, ...). */
export function StatusBadge({ status, label }) {
  const meta = STATUS_META[status] || { label: status, tone: 'stone' };
  return (
    <Badge tone={meta.tone} dot>
      {label || meta.label}
    </Badge>
  );
}

/** Availability as communicated on the shelf: Available / Low stock / Unavailable / Withdrawn. */
export function AvailabilityBadge({ book }) {
  if (book.status === 'INACTIVE') return <Badge tone="stone" dot>Withdrawn</Badge>;
  if (book.availableCopies === 0) return <Badge tone="red" dot>Unavailable</Badge>;
  if (book.availableCopies <= Math.max(1, Math.floor(book.totalCopies * 0.25))) {
    return <Badge tone="amber" dot>Low stock</Badge>;
  }
  return <Badge tone="green" dot>Available</Badge>;
}
