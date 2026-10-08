import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ meta, onPageChange, onLimitChange, limits = [10, 20, 50] }) {
  if (!meta || meta.total === 0) return null;
  const { page, totalPages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      className="flex flex-col gap-3 border-t border-stone-100 px-4 py-3 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination"
    >
      <p className="tabular">
        Showing <span className="font-medium text-stone-900">{from}</span>–<span className="font-medium text-stone-900">{to}</span> of{' '}
        <span className="font-medium text-stone-900">{total}</span>
      </p>
      <div className="flex items-center gap-3">
        {onLimitChange && (
          <label className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-md border border-stone-300 bg-white py-1 pl-2 pr-7 text-xs"
              aria-label="Rows per page"
            >
              {limits.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-stone-300 bg-white p-1.5 hover:bg-stone-50 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[4.5rem] text-center tabular">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-stone-300 bg-white p-1.5 hover:bg-stone-50 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
