import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Settings,
  AlertCircle,
  CheckCircle,
  X,
  Shield,
  Eye,
  Edit as EditIcon,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import {
  getAllUsers,
  registerUser,
  updateUserPermissions,
  updateUserStatus,
  authorizedFetch
} from '../utils/authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface UserInfo {
  id: number;
  username: string;
  email?: string;
  fullName?: string;
  isActive: number;
  lastLogin?: string;
  loginCount?: number;
  permissions?: Permission[];
}

interface Permission {
  id: number;
  code: string;
  name: string;
  level: number;
}

const PERMISSION_LEVELS = [
  { id: 1, code: 'VIEWER', name: '查看员', level: 1 },
  { id: 2, code: 'EDITOR', name: '编辑员', level: 2 },
  { id: 3, code: 'ADMIN', name: '管理员', level: 3 }
];

export function AdminUsers() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit' | 'permissions'>('create');
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

  // 加载用户列表
  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // 打开新建用户对话框
  const handleCreateUser = () => {
    setModalType('create');
    setFormData({});
    setSelectedPermissions([2]); // 默认编辑员
    setShowModal(true);
  };

  // 打开权限管理对话框
  const handleEditPermissions = (user: UserInfo) => {
    setModalType('permissions');
    setSelectedUser(user);
    setSelectedPermissions(user.permissions?.map(p => p.id) || []);
    setShowModal(true);
  };

  // 保存新用户
  const handleSaveUser = async () => {
    setLoading(true);
    setError('');
    try {
      await registerUser(
        formData.username,
        formData.password,
        formData.email,
        formData.fullName,
        selectedPermissions[0] || 2
      );
      setSuccess('用户创建成功');
      setShowModal(false);
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新权限
  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    setLoading(true);
    setError('');
    try {
      await updateUserPermissions(selectedUser.id, selectedPermissions);
      setSuccess('权限更新成功');
      setShowModal(false);
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换用户状态
  const handleToggleUserStatus = async (user: UserInfo) => {
    const confirmMsg = user.isActive ? '确定要禁用此用户吗？' : '确定要启用此用户吗？';
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    setError('');
    try {
      await updateUserStatus(user.id, user.isActive === 0);
      setSuccess('用户状态已更新');
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 过滤用户
  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const text = `${user.username} ${user.email || ''} ${user.fullName || ''}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
        <p className="text-gray-600 mt-2">管理系统用户和权限</p>
      </div>

      {/* 警告/成功信息 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* 工具栏 */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <input
            type="text"
            placeholder="搜索用户名、邮箱或全名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={handleCreateUser}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          新建用户
        </button>
      </div>

      {/* 用户卡片 */}
      <div className="grid gap-4">
        {loading && !users.length ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无用户</div>
        ) : (
          filteredUsers.map(user => (
            <div
              key={user.id}
              className={`bg-white rounded-lg shadow p-4 flex items-center justify-between ${
                user.isActive === 0 ? 'opacity-60' : ''
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    user.isActive ? 'bg-indigo-100' : 'bg-gray-100'
                  }`}>
                    <Shield className={`w-5 h-5 ${
                      user.isActive ? 'text-indigo-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{user.fullName || user.username}</h3>
                    <p className="text-sm text-gray-500">{user.username}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.permissions?.map(perm => (
                    <span
                      key={perm.id}
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        perm.level === 3 ? 'bg-red-100 text-red-700' :
                        perm.level === 2 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {perm.name}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {user.email && <p>📧 {user.email}</p>}
                  {user.lastLogin && <p>最后登录: {new Date(user.lastLogin).toLocaleString('zh-CN')}</p>}
                  <p>登录次数: {user.loginCount || 0}</p>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditPermissions(user)}
                  disabled={loading}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50"
                  title="编辑权限"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleUserStatus(user)}
                  disabled={loading}
                  className={`p-2 rounded-lg disabled:opacity-50 ${
                    user.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                  }`}
                  title={user.isActive ? '禁用用户' : '启用用户'}
                >
                  {user.isActive ? (
                    <ToggleRight className="w-4 h-4" />
                  ) : (
                    <ToggleLeft className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 对话框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {modalType === 'create' && '新建用户'}
                {modalType === 'permissions' && '编辑权限'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalType === 'create' ? (
              // 新建用户表单
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                  <input
                    type="text"
                    value={formData.username || ''}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                  <input
                    type="password"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">全名</label>
                  <input
                    type="text"
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">初始权限</label>
                  <div className="space-y-2">
                    {PERMISSION_LEVELS.map(perm => (
                      <label key={perm.id} className="flex items-center">
                        <input
                          type="radio"
                          name="permission"
                          value={perm.id}
                          checked={selectedPermissions[0] === perm.id}
                          onChange={(e) => setSelectedPermissions([Number(e.target.value)])}
                          className="rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{perm.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // 权限编辑
              <div className="space-y-2">
                {PERMISSION_LEVELS.map(perm => (
                  <label key={perm.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(perm.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPermissions([...selectedPermissions, perm.id]);
                        } else {
                          setSelectedPermissions(selectedPermissions.filter(id => id !== perm.id));
                        }
                      }}
                      className="rounded"
                    />
                    <div className="ml-3 flex-1">
                      <p className="font-medium text-sm text-gray-900">{perm.name}</p>
                      <p className="text-xs text-gray-500">
                        {perm.code === 'ADMIN' && '拥有完全权限'}
                        {perm.code === 'EDITOR' && '可以创建和编辑'}
                        {perm.code === 'VIEWER' && '只能查看'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (modalType === 'create') {
                    handleSaveUser();
                  } else {
                    handleSavePermissions();
                  }
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;
