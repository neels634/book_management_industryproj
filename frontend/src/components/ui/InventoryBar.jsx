/**
 * Shelf-style bar showing where every copy is:
 * available (green), on loan (blue), damaged (amber), lost (red).
 */
export default function InventoryBar({ book, showLegend = false, compact = false }) {
  const total = book.totalCopies || 0;
  const parts = [
    { key: 'availableCopies', label: 'Available', color: 'bg-emerald-500' },
    { key: 'issuedCopies', label: 'On loan', color: 'bg-sky-500' },
    { key: 'damagedCopies', label: 'Damaged', color: 'bg-amber-400' },
    { key: 'lostCopies', label: 'Lost', color: 'bg-rose-500' },
  ];

  return (
    <div className={compact ? 'w-28' : 'w-full'}>
      <div
        className={`flex overflow-hidden rounded-full bg-stone-100 ${compact ? 'h-1.5' : 'h-2.5'}`}
        role="img"
        aria-label={`${book.availableCopies} of ${total} copies available`}
      >
        {total > 0 &&
          parts.map((p) =>
            book[p.key] > 0 ? (
              <span key={p.key} className={p.color} style={{ width: `${(book[p.key] / total) * 100}%` }} />
            ) : null
          )}
      </div>
      {compact && (
        <p className="mt-1 text-xs text-stone-500 tabular">
          <span className="font-semibold text-stone-800">{book.availableCopies}</span> of {total} available
        </p>
      )}
      {showLegend && (
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-sm ${p.color}`} aria-hidden />
              <span className="text-stone-500">{p.label}</span>
              <span className="ml-auto font-semibold text-stone-900 tabular sm:ml-0">{book[p.key] || 0}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
