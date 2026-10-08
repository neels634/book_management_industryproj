const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', ...options });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoney(amount, currency = 'INR') {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0));
}

/** "Due in 3 days", "Due today", "4 days overdue". */
export function dueLabel(dueDate) {
  if (!dueDate) return '';
  const end = new Date(dueDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const days = Math.round((end.getTime() - today.getTime()) / DAY_MS);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  return `${-days} day${days === -1 ? '' : 's'} overdue`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

/** yyyy-mm-dd for <input type="date"> in local time. */
export function toDateInput(value) {
  const d = value ? new Date(value) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function titleCase(value = '') {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
