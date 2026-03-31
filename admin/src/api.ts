import type { ApiEnvelope, DictionaryResponse, EventPageResponse, ProductPageResponse, UserItem } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'sentry_admin_token';

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `请求失败: ${response.status}`);
  }

  return (payload.data ?? (payload as T)) as T;
}

export async function login(username: string, password: string) {
  return request<{ token: string; user: unknown }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function fetchUsers() {
  return request<UserItem[]>('/auth/users', { method: 'GET' });
}

export async function registerUser(input: {
  username: string;
  password: string;
  email: string;
  fullName?: string;
  permissionId?: number;
}) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateUserStatus(userId: number, isActive: boolean) {
  return request(`/auth/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  });
}

export async function updateUserPermissions(userId: number, permissionIds: number[]) {
  return request(`/auth/users/${userId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionIds })
  });
}

export async function fetchDictionary(dictType: string, page = 1, limit = 50) {
  return request<DictionaryResponse>(`/admin/dictionaries/${dictType}?page=${page}&limit=${limit}`);
}

export async function createDictionaryItem(dictType: string, item: Record<string, unknown>) {
  return request(`/admin/dictionaries/${dictType}`, {
    method: 'POST',
    body: JSON.stringify(item)
  });
}

export async function deleteDictionaryItem(dictType: string, id: number) {
  return request(`/admin/dictionaries/${dictType}/${id}`, {
    method: 'DELETE'
  });
}

export async function importDictionaryItems(dictType: string, items: Record<string, unknown>[]) {
  return request(`/admin/dictionaries/${dictType}/import`, {
    method: 'POST',
    body: JSON.stringify({ items })
  });
}

export async function exportDictionary(dictType: string) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/admin/dictionaries/${dictType}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    throw new Error('导出失败');
  }

  return response.json();
}

export async function fetchProducts(page = 1, perPage = 20) {
  return request<ProductPageResponse>(`/management/products?page=${page}&per_page=${perPage}`);
}

export async function createProduct(input: {
  name: string;
  hs_code?: string;
  gpc_code?: string;
  category?: string;
  description?: string;
  supply_chain_stage?: string;
}) {
  return request('/management/products', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateProduct(
  id: string,
  input: {
    name?: string;
    hs_code?: string;
    gpc_code?: string;
    category?: string;
    description?: string;
    supply_chain_stage?: string;
  }
) {
  return request(`/management/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}

export async function deleteProduct(id: string) {
  return request(`/management/products/${id}`, {
    method: 'DELETE'
  });
}

export async function fetchEvents(page = 1, perPage = 20) {
  return request<EventPageResponse>(`/events?page=${page}&per_page=${perPage}`);
}

export async function createEvent(input: {
  title: string;
  description?: string;
  image_url?: string;
  event_type_text?: string;
  location?: string;
  target?: string;
  severity?: 'critical' | 'warning' | 'info';
  confidence_score?: number;
  occurred_at: string;
  source_id?: number;
  locode_point_id?: number;
  risk_tier2_type_id?: number;
  product_tier3_ids?: number[];
  domain_focus_l2_id?: number;
  supplychain_tier2_id?: number;
}) {
  return request('/events', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateEvent(
  id: string,
  input: {
    title?: string;
    description?: string;
    image_url?: string;
    event_type_text?: string;
    location?: string;
    target?: string;
    severity?: 'critical' | 'warning' | 'info';
    confidence_score?: number;
    occurred_at?: string;
    source_id?: number;
    locode_point_id?: number;
    risk_tier2_type_id?: number;
    product_tier3_ids?: number[];
    domain_focus_l2_id?: number;
    supplychain_tier2_id?: number;
  }
) {
  return request(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}

export async function deleteEvent(id: string) {
  return request(`/events/${id}`, {
    method: 'DELETE'
  });
}
