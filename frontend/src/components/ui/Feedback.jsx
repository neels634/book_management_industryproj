import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react';
import Button from './Button';

export function Spinner({ className = 'h-5 w-5', label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={`animate-spin text-ink-600 ${className}`} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-stone-500">
      <Spinner className="h-7 w-7" />
      {label}
    </div>
  );
}

export function SkeletonRows({ rows = 6, columns = 5 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r}>
      {Array.from({ length: columns }).map((__, c) => (
        <td key={c} className="px-4 py-3.5">
          <div className={`h-3.5 animate-pulse rounded bg-stone-200/80 ${c === 0 ? 'w-40' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  ));
}

export function SkeletonBlock({ className = 'h-24' }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200/70 ${className}`} />;
}

const ALERT_TONES = {
  info: { classes: 'border-sky-200 bg-sky-50 text-sky-900', Icon: Info },
  success: { classes: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CheckCircle2 },
  warning: { classes: 'border-amber-200 bg-amber-50 text-amber-900', Icon: AlertTriangle },
  error: { classes: 'border-rose-200 bg-rose-50 text-rose-900', Icon: AlertCircle },
};

export function Alert({ tone = 'info', title, children, className = '', action }) {
  const { classes, Icon } = ALERT_TONES[tone];
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${classes} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-ink-600">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      )}
      <p className="font-display text-lg font-semibold text-stone-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertCircle className="h-6 w-6" aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold text-stone-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-stone-500">{error?.message || 'Please try again.'}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
