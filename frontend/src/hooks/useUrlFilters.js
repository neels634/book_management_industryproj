import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps list filters in the URL (shareable, survives refresh / back button).
 * Changing any filter other than `page` resets to page 1.
 */
export function useUrlFilters(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const values = { ...defaults };
    searchParams.forEach((value, key) => {
      values[key] = value;
    });
    return values;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setFilters = useCallback(
    (changes) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([key, value]) => {
            if (value === '' || value === null || value === undefined || value === defaults[key]) next.delete(key);
            else next.set(key, String(value));
          });
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSearchParams]
  );

  return [filters, setFilters];
}
