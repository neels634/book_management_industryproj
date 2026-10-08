import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services';
import { setUnauthorizedHandler, tokenStore } from '../services/api';

export const AuthContext = createContext(null);

/**
 * Holds the signed-in user. status is:
 *   'loading'        - checking a stored token on first load
 *   'authenticated'  - user is set
 *   'anonymous'      - no valid session
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'loading' : 'anonymous'));
  const [sessionMessage, setSessionMessage] = useState('');

  const clearSession = useCallback((message = '') => {
    tokenStore.clear();
    setUser(null);
    setStatus('anonymous');
    setSessionMessage(message);
  }, []);

  // Any 401 from the API (expired/revoked token, deactivated account) ends the session.
  useEffect(() => {
    setUnauthorizedHandler((error) => clearSession(error.message));
  }, [clearSession]);

  useEffect(() => {
    if (status !== 'loading') return;
    authService
      .me()
      .then((res) => {
        setUser(res.data);
        setStatus('authenticated');
      })
      .catch(() => clearSession());
  }, [status, clearSession]);

  const login = useCallback(async (credentials) => {
    const res = await authService.login(credentials);
    tokenStore.set(res.data.token);
    setUser(res.data.user);
    setSessionMessage('');
    setStatus('authenticated');
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* the token is discarded locally either way */
    }
    clearSession();
  }, [clearSession]);

  /** After a password change the API issues a fresh token. */
  const replaceToken = useCallback((token) => tokenStore.set(token), []);

  const value = useMemo(
    () => ({
      user,
      status,
      sessionMessage,
      isAuthenticated: status === 'authenticated',
      hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
      login,
      logout,
      replaceToken,
    }),
    [user, status, sessionMessage, login, logout, replaceToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
