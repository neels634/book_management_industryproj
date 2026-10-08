import api, { request } from './api';

export const authService = {
  login: (credentials) => request(api.post('/auth/login', credentials)),
  me: () => request(api.get('/auth/me')),
  logout: () => request(api.post('/auth/logout')),
  changePassword: (body) => request(api.put('/auth/password', body)),
};

export const bookService = {
  list: (params) => request(api.get('/books', { params })),
  get: (id) => request(api.get(`/books/${id}`)),
  history: (id, params) => request(api.get(`/books/${id}/transactions`, { params })),
  create: (body) => request(api.post('/books', body)),
  update: (id, body) => request(api.put(`/books/${id}`, body)),
  adjustCopies: (id, body) => request(api.patch(`/books/${id}/copies`, body)),
  deactivate: (id) => request(api.delete(`/books/${id}`)),
};

export const memberService = {
  list: (params) => request(api.get('/members', { params })),
  get: (id) => request(api.get(`/members/${id}`)),
  history: (id, params) => request(api.get(`/members/${id}/transactions`, { params })),
  create: (body) => request(api.post('/members', body)),
  update: (id, body) => request(api.put(`/members/${id}`, body)),
  deactivate: (id) => request(api.delete(`/members/${id}`)),
};

export const categoryService = {
  list: (params) => request(api.get('/categories', { params })),
  create: (body) => request(api.post('/categories', body)),
  update: (id, body) => request(api.put(`/categories/${id}`, body)),
  deactivate: (id) => request(api.delete(`/categories/${id}`)),
};

export const transactionService = {
  list: (params) => request(api.get('/transactions', { params })),
  get: (id) => request(api.get(`/transactions/${id}`)),
  issue: (body) => request(api.post('/transactions/issue', body)),
  return: (body) => request(api.post('/transactions/return', body)),
  renew: (id, body = {}) => request(api.post(`/transactions/${id}/renew`, body)),
  markLost: (id, body = {}) => request(api.post(`/transactions/${id}/lost`, body)),
  settleFine: (id, body) => request(api.post(`/transactions/${id}/fine`, body)),
};

export const reportService = {
  dashboard: () => request(api.get('/reports/dashboard')),
  overdue: (params) => request(api.get('/reports/overdue', { params })),
  popularBooks: (params) => request(api.get('/reports/popular-books', { params })),
  books: (params) => request(api.get('/reports/books', { params })),
  categories: (params) => request(api.get('/reports/categories', { params })),
  fines: (params) => request(api.get('/reports/fines', { params })),
  memberHistory: (params) => request(api.get('/reports/member-history', { params })),
};

export const settingService = {
  get: () => request(api.get('/settings')),
  update: (body) => request(api.put('/settings', body)),
};

export const userService = {
  list: (params) => request(api.get('/users', { params })),
  create: (body) => request(api.post('/users', body)),
  update: (id, body) => request(api.put(`/users/${id}`, body)),
  deactivate: (id) => request(api.delete(`/users/${id}`)),
};
