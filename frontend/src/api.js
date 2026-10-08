// On a phone using Expo Go, set EXPO_PUBLIC_API_URL to your computer's LAN address,
// e.g. http://192.168.1.10:8000 (localhost on the phone is the phone itself).
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the server at ${BASE_URL}`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // FastAPI returns either a string or a list of validation errors in "detail".
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => `${d.loc[d.loc.length - 1]}: ${d.msg.replace('Value error, ', '')}`).join('\n')
      : detail || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

const query = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  return search.toString() ? `?${search}` : '';
};

export const api = {
  dashboard: () => request('/dashboard'),
  books: (q = '') => request(`/books${query({ q })}`),
  createBook: (body) => request('/books', { method: 'POST', body }),
  updateBook: (id, body) => request(`/books/${id}`, { method: 'PUT', body }),
  deleteBook: (id) => request(`/books/${id}`, { method: 'DELETE' }),
  members: (q = '') => request(`/members${query({ q })}`),
  createMember: (body) => request('/members', { method: 'POST', body }),
  updateMember: (id, body) => request(`/members/${id}`, { method: 'PUT', body }),
  deleteMember: (id) => request(`/members/${id}`, { method: 'DELETE' }),
  loans: (status = '') => request(`/loans${query({ status })}`),
  issue: (body) => request('/loans/issue', { method: 'POST', body }),
  returnLoan: (id) => request(`/loans/${id}/return`, { method: 'POST' }),
};
