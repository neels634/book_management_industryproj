import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { SettingsContext } from '../context/SettingsContext';
import { ToastProvider } from '../context/ToastContext';

export const SETTINGS = {
  libraryName: 'Test Library',
  currency: 'INR',
  finePerDay: 5,
  loanPeriodDays: 14,
  maxLoanPeriodDays: 60,
  defaultBorrowingLimit: 3,
  maxRenewals: 2,
  lostBookFee: 500,
  damagedBookFee: 100,
  maxOutstandingFine: 200,
  blockBorrowingWhenOverdue: true,
};

export const USERS = {
  ADMIN: { _id: 'u1', name: 'Asha Admin', username: 'admin', role: 'ADMIN' },
  LIBRARIAN: { _id: 'u2', name: 'Leela Librarian', username: 'librarian', role: 'LIBRARIAN' },
  MEMBER: {
    _id: 'u3',
    name: 'Aarav Mehta',
    username: 'member',
    role: 'MEMBER',
    member: { memberId: 'MEM-00001', name: 'Aarav Mehta', borrowingLimit: 3, membershipStatus: 'ACTIVE', membershipType: 'STUDENT' },
  },
};

/**
 * Renders UI with router + auth + settings + toasts.
 * Pass `user: null` for an anonymous visitor.
 */
export function renderWithProviders(ui, { route = '/', path = '*', user = USERS.ADMIN, auth = {}, settings = SETTINGS } = {}) {
  const authValue = {
    user,
    status: user ? 'authenticated' : 'anonymous',
    isAuthenticated: Boolean(user),
    sessionMessage: '',
    hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
    login: async () => user,
    logout: async () => {},
    replaceToken: () => {},
    ...auth,
  };
  return render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <AuthContext.Provider value={authValue}>
          <SettingsContext.Provider value={{ settings, setSettings: () => {}, reload: () => {} }}>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="/login" element={<p>Login screen</p>} />
              <Route path="/dashboard" element={<p>Dashboard screen</p>} />
            </Routes>
          </SettingsContext.Provider>
        </AuthContext.Provider>
      </ToastProvider>
    </MemoryRouter>
  );
}

export const paged = (data, extra = {}) => ({
  success: true,
  data,
  meta: { page: 1, limit: 10, total: data.length, totalPages: 1, ...extra },
});

export const makeBook = (overrides = {}) => ({
  _id: `b${Math.random().toString(36).slice(2, 8)}`,
  bookId: 'BK-00001',
  title: 'Clean Code',
  isbn: '9780132350884',
  authors: ['Robert C. Martin'],
  category: { _id: 'c1', name: 'Technology' },
  totalCopies: 5,
  availableCopies: 3,
  issuedCopies: 2,
  damagedCopies: 0,
  lostCopies: 0,
  status: 'ACTIVE',
  ...overrides,
});
