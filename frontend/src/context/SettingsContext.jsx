import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { settingService } from '../services';
import { useAuth } from '../hooks/useAuth';

const FALLBACK = {
  libraryName: 'Library',
  currency: 'INR',
  finePerDay: 0,
  loanPeriodDays: 14,
  maxLoanPeriodDays: 60,
  defaultBorrowingLimit: 3,
  maxRenewals: 2,
};

export const SettingsContext = createContext({ settings: FALLBACK, reload: () => {} });

/** Library policy (currency, loan period, fine rate) needed across many screens. */
export function SettingsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState(FALLBACK);

  const reload = useCallback(async () => {
    try {
      const res = await settingService.get();
      setSettings({ ...FALLBACK, ...res.data });
    } catch {
      /* keep the previous values */
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) reload();
  }, [isAuthenticated, reload]);

  const value = useMemo(() => ({ settings, setSettings, reload }), [settings, reload]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
