/**
 * 认证服务
 * 处理用户登录、令牌管理等
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_info';

export interface User {
  id: number;
  username: string;
  email?: string;
  fullName?: string;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  level: number;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

/**
 * 用户登录
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || '登录失败');
  }

  // 保存令牌和用户信息到本地存储
  localStorage.setItem(TOKEN_KEY, data.data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));

  return data;
}

/**
 * 用户登出
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * 获取保存的令牌
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 获取保存的用户信息
 */
export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * 检查用户是否已认证
 */
export function isAuthenticated(): boolean {
  // Demo mode support - allow for demo/testing
  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true' ||
    localStorage.getItem('demo_mode') === 'true';
  if (isDemoMode) {
    // Set a demo token if not exists
    if (!localStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(TOKEN_KEY, 'demo-token-' + Date.now());
      localStorage.setItem(USER_KEY, JSON.stringify({
        id: 1,
        username: 'demo',
        email: 'demo@example.com',
        fullName: 'Demo User',
        permissions: [{ id: 1, code: 'VIEWER', name: 'Viewer', level: 1 }]
      }));
    }
    return true;
  }
  return !!getToken();
}

/**
 * 检查用户是否有特定权限
 */
export function hasPermission(code: string): boolean {
  const user = getCurrentUser();
  return user?.permissions?.some(p => p.code === code) ?? false;
}

/**
 * 检查用户是否是管理员
 */
export function isAdmin(): boolean {
  return hasPermission('ADMIN');
}

/**
 * 检查用户权限等级
 */
export function getMaxPermissionLevel(): number {
  const user = getCurrentUser();
  return Math.max(...(user?.permissions?.map(p => p.level) || [0]));
}

/**
 * 验证令牌
 */
export async function verifyToken(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok && (await response.json()).success;
  } catch (error) {
    return false;
  }
}

/**
 * 带认证的API请求
 */
export async function authorizedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * 获取所有用户（仅管理员）
 */
export async function getAllUsers(): Promise<any[]> {
  const response = await authorizedFetch(`${API_BASE_URL}/auth/users`);
  const data = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error(data.message || '获取用户列表失败');
  }

  return data.data;
}

/**
 * 注册新用户（仅管理员）
 */
export async function registerUser(
  username: string,
  password: string,
  email: string,
  fullName: string,
  permissionId: number
): Promise<any> {
  const response = await authorizedFetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      email,
      fullName,
      permissionId
    })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || '用户注册失败');
  }

  return data.data;
}

/**
 * 更新用户权限（仅管理员）
 */
export async function updateUserPermissions(
  userId: number,
  permissionIds: number[]
): Promise<void> {
  const response = await authorizedFetch(`${API_BASE_URL}/auth/users/${userId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionIds })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || '更新权限失败');
  }
}

/**
 * 禁用/启用用户（仅管理员）
 */
export async function updateUserStatus(userId: number, isActive: boolean): Promise<void> {
  const response = await authorizedFetch(`${API_BASE_URL}/auth/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || '更新用户状态失败');
  }
}
