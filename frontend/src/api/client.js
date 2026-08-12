// Cliente HTTP central. Injeta o token JWT automaticamente e normaliza erros.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, { method = 'GET', body, token, isBlob = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (isBlob) {
    if (!res.ok) throw new Error('Falha ao baixar arquivo.');
    return res.blob();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Erro inesperado ao comunicar com o servidor.');
  }
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, newPassword) => request('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),

  // Tenants (Super Admin)
  listTenants: (token, status) => request(`/tenants${status ? `?status=${status}` : ''}`, { token }),
  tenantsOverview: (token) => request('/tenants/overview', { token }),
  approveTenant: (token, id) => request(`/tenants/${id}/approve`, { method: 'PATCH', token }),
  rejectTenant: (token, id) => request(`/tenants/${id}/reject`, { method: 'PATCH', token }),
  suspendTenant: (token, id) => request(`/tenants/${id}/suspend`, { method: 'PATCH', token }),

  // Tags
  listTags: (token) => request('/tags', { token }),
  getNfcModels: (token) => request('/tags/models', { token }),
  createTag: (token, payload) => request('/tags', { method: 'POST', token, body: payload }),
  updateTag: (token, id, payload) => request(`/tags/${id}`, { method: 'PUT', token, body: payload }),
  deleteTag: (token, id) => request(`/tags/${id}`, { method: 'DELETE', token }),
  bulkImportTags: (token, rows) => request('/tags/bulk-import', { method: 'POST', token, body: { rows } }),
  exportBatchCsv: (token) => request('/tags/export-batch', { token, isBlob: true }),

  // Público
  getPublicTag: (tagId) => request(`/public/nfc/${tagId}`),

  // Marca (branding) do próprio tenant
  getBranding: (token) => request('/branding', { token }),
  updateBranding: (token, payload) => request('/branding', { method: 'PUT', token, body: payload }),
};
