import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { Spinner } from './Feedback';

/**
 * Searchable single-select (ARIA combobox) backed by an API search.
 *
 *   <EntityPicker search={(q) => memberService.list({ q }).then(r => r.data)}
 *                 renderOption={(m) => ...}
 *                 value={member} onChange={setMember} />
 */
export default function EntityPicker({
  label,
  placeholder = 'Start typing to search…',
  search,
  renderOption,
  value,
  onChange,
  error,
  autoFocus,
  emptyText = 'No matches',
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(query, 250);
  const wrapperRef = useRef(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    searchRef
      .current(debounced)
      .then((items) => {
        if (!cancelled) {
          setResults(items);
          setActive(0);
        }
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  useEffect(() => {
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const select = (item) => {
    onChange(item);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault();
      select(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (value) {
    return (
      <div>
        {label && <p className="label">{label}</p>}
        <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-ink-50/50 p-3">
          <div className="min-w-0 flex-1">{renderOption(value, true)}</div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md p-1 text-stone-400 hover:bg-white hover:text-stone-700"
            aria-label={`Clear ${label || 'selection'}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`input pl-9 ${error ? 'input-error' : ''}`}
        />
        {loading && open && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner className="h-4 w-4" />
          </span>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lifted"
        >
          {!loading && results.length === 0 && <li className="px-3 py-3 text-sm text-stone-500">{emptyText}</li>}
          {results.map((item, i) => (
            <li
              key={item._id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                select(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-ink-50' : ''}`}
            >
              {renderOption(item, false)}
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">
        {open && !loading ? `${results.length} results` : ''}
      </span>
    </div>
  );
}
