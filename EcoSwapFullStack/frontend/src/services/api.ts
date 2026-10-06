const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    const timeout = path === '/ai/chat' ? 30000 : 10000;
    response = await fetch(`${API}${path}`, { ...options, headers, signal: AbortSignal.timeout(timeout) });
  } catch {
    throw new Error('Backend server is unavailable. Start the backend and verify its API URL.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body)
});

export const api = {
  register: (body: unknown) => request('/auth/register', json('POST', body)),
  login: (body: unknown) => request('/auth/login', json('POST', body)),
  me: () => request('/auth/me'),
  profile: () => request('/users/profile'),
  updateProfile: (body: unknown) => request('/users/profile', json('PUT', body)),
  products: () => request('/products'),
  myProducts: () => request('/products/mine'),
  product: (id: string) => request(`/products/${encodeURIComponent(id)}`),
  updateProduct: (id: string, body: unknown) => request(`/products/${encodeURIComponent(id)}`, json('PUT', body)),
  createPaymentOrder: (body: unknown) => request('/orders/checkout', json('POST', body)),
  verifyPayment: (body: unknown) => request('/orders/verify-payment', json('POST', body)),
  cancelPayment: (body: unknown) => request('/orders/cancel-payment', json('POST', body)),
  orders: () => request('/orders'),
  createProduct: (body: unknown) => request('/products', json('POST', body)),
  upload: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return request('/upload', { method: 'POST', body: form });
  },
  analyze: (condition: string, category: string) => request('/ai/analyze', json('POST', { condition, category })),
  chat: (message: string, history: Array<{ role: string; content: string }> = []) => request('/ai/chat', json('POST', { message, history })),
  requests: (body: unknown) => request('/requests', json('POST', body)),
  myRequests: () => request('/requests'),
  stats: () => request('/admin/stats'),
  users: () => request('/admin/users'),
  adminProducts: () => request('/admin/products'),
  adminOrders: () => request('/admin/orders'),
  adminRequests: () => request('/admin/requests'),
  updateAdminRequest: (id: string, status: string) => request(`/admin/requests/${encodeURIComponent(id)}`, json('PATCH', { status })),
  removeProduct: (id: string) => request(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
};
