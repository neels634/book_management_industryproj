import axios from 'axios';

const TOKEN_KEY = 'folio.token';

/** localStorage can throw (private mode, blocked storage) - never let that break the app. */
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Error shape every service call rejects with. */
export class ApiRequestError extends Error {
  constructor({ message, code, status, details }) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.details = details || [];
    // { fieldName: 'message' } for showing errors next to form inputs
    this.fieldErrors = Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

function toApiRequestError(error) {
  if (error.response) {
    const body = error.response.data || {};
    return new ApiRequestError({
      message: body.error?.message || `Request failed (${error.response.status})`,
      code: body.error?.code || 'HTTP_ERROR',
      status: error.response.status,
      details: body.error?.details,
    });
  }
  if (error.code === 'ECONNABORTED') {
    return new ApiRequestError({ message: 'The server took too long to respond. Please try again.', code: 'TIMEOUT' });
  }
  return new ApiRequestError({
    message: 'Cannot reach the server. Check your connection and that the API is running.',
    code: 'NETWORK_ERROR',
  });
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let unauthorizedHandler = () => {};
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Drop empty query params so the API never receives ?category=
  if (config.params) {
    config.params = Object.fromEntries(
      Object.entries(config.params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = toApiRequestError(error);
    const isLogin = error.config?.url?.includes('/auth/login');
    if (normalized.status === 401 && !isLogin) unauthorizedHandler(normalized);
    return Promise.reject(normalized);
  }
);

/** Returns the JSON body: { success, data, meta?, message? }. */
export const request = (promise) => promise.then((res) => res.data);

export default api;
