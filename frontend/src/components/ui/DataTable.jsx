import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { SkeletonRows } from './Feedback';
import { EmptyState } from './Feedback';

/**
 * Responsive data table.
 *  - md and up: a regular table with optional sortable headers.
 *  - below md: each row becomes a stacked card (header: value pairs), so no
 *    horizontal scrolling on phones.
 *
 * columns: [{ key, header, render?(row), sortKey?, className?, mobile?: 'title' | 'hidden' }]
 */
export default function DataTable({
  columns,
  rows,
  loading,
  rowKey = (row) => row._id,
  onRowClick,
  sort,
  onSortChange,
  empty,
  caption,
}) {
  const visible = columns.filter((c) => !c.hidden);
  const titleColumn = visible.find((c) => c.mobile === 'title') || visible[0];
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key] ?? '—');

  const toggleSort = (key) => {
    if (!onSortChange) return;
    if (sort?.sortBy === key) onSortChange({ sortBy: key, order: sort.order === 'asc' ? 'desc' : 'asc' });
    else onSortChange({ sortBy: key, order: 'asc' });
  };

  if (!loading && rows.length === 0) {
    return empty || <EmptyState title="Nothing to show" description="No records match the current filters." />;
  }

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/70">
              {visible.map((col) => {
                const active = Boolean(col.sortKey) && sort?.sortBy === col.sortKey;
                const SortIcon = !active ? ChevronsUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500 ${col.className || ''}`}
                  >
                    {col.sortKey && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.sortKey)}
                        className={`inline-flex items-center gap-1 uppercase hover:text-stone-800 ${active ? 'text-stone-800' : ''}`}
                      >
                        {col.header}
                        <SortIcon className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <SkeletonRows columns={visible.length} />
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`align-middle transition-colors ${onRowClick ? 'cursor-pointer hover:bg-ink-50/40' : ''}`}
                >
                  {visible.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                      {cell(col, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Phones */}
      <ul className="divide-y divide-stone-100 md:hidden">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
              </li>
            ))
          : rows.map((row) => (
              <li
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`p-4 ${onRowClick ? 'cursor-pointer active:bg-stone-50' : ''}`}
              >
                <div className="mb-2">{cell(titleColumn, row)}</div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {visible
                    .filter((c) => c !== titleColumn && c.mobile !== 'hidden')
                    .map((col) => (
                      <div key={col.key} className={`min-w-0 ${col.mobile === 'full' ? 'col-span-2' : ''}`}>
                        {col.header && <dt className="text-[11px] uppercase tracking-wide text-stone-400">{col.header}</dt>}
                        <dd className="mt-0.5 min-w-0 break-words">{cell(col, row)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
      </ul>
    </>
  );
}
