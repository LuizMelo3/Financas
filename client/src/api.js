const BASE = '/api';

function getToken() {
  return localStorage.getItem('finance_token');
}

async function req(method, path, body) {
  const token = getToken();
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);

  const r = await fetch(BASE + path, opts);

  if (r.status === 401) {
    localStorage.removeItem('finance_token');
    localStorage.removeItem('finance_user');
    window.location.href = '/login';
    return;
  }

  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(msg || r.statusText);
  }
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) return r.json();
  return r;
}

export const api = {
  get:   (path)       => req('GET',    path),
  post:  (path, body) => req('POST',   path, body),
  put:   (path, body) => req('PUT',    path, body),
  del:   (path)       => req('DELETE', path),
  patch: (path, body) => req('PATCH',  path, body),

  auth: {
    register: (body) => req('POST', '/auth/register', body),
    login:    (body) => req('POST', '/auth/login',    body),
    me:       ()     => req('GET',  '/auth/me'),
  },

  dashboard:  ()     => api.get('/dashboard'),
  accounts:   ()     => api.get('/accounts'),
  transfers:  (body) => api.post('/transfers', body),
  categories: (type) => api.get('/categories' + (type ? `?type=${type}` : '')),

  transactions: {
    list:   (params) => api.get('/transactions?' + new URLSearchParams(params||{}).toString()),
    create: (body)   => api.post('/transactions', body),
    update: (id, b)  => api.put(`/transactions/${id}`, b),
    del:    (id)     => api.del(`/transactions/${id}`),
    pay:    (id)     => api.post(`/transactions/${id}/pay`, {}),
  },

  debts: {
    list:   ()       => api.get('/debts'),
    create: (body)   => api.post('/debts', body),
    update: (id, b)  => api.put(`/debts/${id}`, b),
    pay:    (id)     => api.post(`/debts/${id}/pay`, {}),
    del:    (id)     => api.del(`/debts/${id}`),
  },

  investments: {
    list:     ()       => api.get('/investments'),
    create:   (body)   => api.post('/investments', body),
    update:   (id, b)  => api.put(`/investments/${id}`, b),
    withdraw: (id, b)  => api.post(`/investments/${id}/withdraw`, b),
    del:      (id)     => api.del(`/investments/${id}`),
  },

  goals: {
    list:       ()       => api.get('/goals'),
    create:     (body)   => api.post('/goals', body),
    update:     (id, b)  => api.put(`/goals/${id}`, b),
    contribute: (id, b)  => api.post(`/goals/${id}/contribute`, b),
    del:        (id)     => api.del(`/goals/${id}`),
  },

  cards: {
    list:      ()         => api.get('/credit-cards'),
    create:    (body)     => api.post('/credit-cards', body),
    del:       (id)       => api.del(`/credit-cards/${id}`),
    purchases: (id)       => api.get(`/credit-cards/${id}/purchases`),
    buy:       (id, b)    => api.post(`/credit-cards/${id}/purchase`, b),
    pay:       (cId, pId) => api.post(`/credit-cards/${cId}/purchases/${pId}/pay`, {}),
  },

  budgets: {
    list: (month) => api.get('/budgets' + (month ? `?month=${month}` : '')),
    save: (body)  => api.post('/budgets', body),
    del:  (id)    => api.del(`/budgets/${id}`),
  },

  reports: {
    data:   (params) => api.get('/reports?' + new URLSearchParams(params||{}).toString()),
    csvUrl: (params) => '/api/reports/csv?' + new URLSearchParams(params||{}).toString(),
  },

  backup:  ()     => api.get('/backup'),
  restore: (data) => api.post('/restore', data),
  clear:   ()     => api.post('/clear', {}),
};
