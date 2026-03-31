import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { authorizedFetch } from '../utils/authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface DictionaryItem {
  id: number;
  [key: string]: any;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DICT_TYPES = [
  { value: 'product_tier1', label: '产品一级分类' },
  { value: 'product_tier2', label: '产品二级分类' },
  { value: 'product_tier3', label: '产品三级分类' },
  { value: 'risk_tier1', label: '风险一级分类' },
  { value: 'risk_tier2', label: '风险二级分类' },
  { value: 'natural_disaster_tier1', label: '自然灾害灾类' },
  { value: 'natural_disaster_tier2', label: '自然灾害灾种' },
  { value: 'supplychain_tier1', label: '供应链一级流程' },
  { value: 'supplychain_tier2', label: '供应链二级流程' },
  { value: 'enterprise_industry_tier1', label: '企业一级行业' },
  { value: 'media_tier', label: '媒体分层' },
  { value: 'media_role', label: '媒体角色' },
  { value: 'media_domain_focus_l1', label: '内容定位一级' },
  { value: 'media_domain_focus_l2', label: '内容定位二级' },
  { value: 'country', label: '国家编码' },
  { value: 'locode_point', label: 'UN/LOCODE 点位' },
  { value: 'transport_type', label: '运输方式' }
];

export function AdminDictionaries() {
  const [selectedType, setSelectedType] = useState(DICT_TYPES[0].value);
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DictionaryItem | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // 加载数据
  const loadData = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const url = `${API_BASE_URL}/admin/dictionaries/${selectedType}?page=${page}&limit=${pagination.limit}`;
      const response = await authorizedFetch(url);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || '加载失败');
      }

      setItems(data.data.items);
      setPagination({
        page: data.data.pagination.page,
        limit: data.data.pagination.limit,
        total: data.data.pagination.total,
        totalPages: data.data.pagination.totalPages
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [selectedType]);

  // 打开编辑对话框
  const handleEdit = (item: DictionaryItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  // 打开创建对话框
  const handleCreate = () => {
    setEditingItem(null);
    setFormData({});
    setShowModal(true);
  };

  // 保存
  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      if (editingItem) {
        // 编辑
        const response = await authorizedFetch(
          `${API_BASE_URL}/admin/dictionaries/${selectedType}/${editingItem.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(formData)
          }
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || '更新失败');
        }
      } else {
        // 创建
        const response = await authorizedFetch(
          `${API_BASE_URL}/admin/dictionaries/${selectedType}`,
          {
            method: 'POST',
            body: JSON.stringify(formData)
          }
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || '创建失败');
        }
      }
      setSuccess(editingItem ? '更新成功' : '创建成功');
      setShowModal(false);
      await loadData(pagination.page);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除吗？')) return;

    setLoading(true);
    setError('');
    try {
      const response = await authorizedFetch(
        `${API_BASE_URL}/admin/dictionaries/${selectedType}/${id}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || '删除失败');
      }
      setSuccess('删除成功');
      await loadData(pagination.page);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  };

  // 导出
  const handleExport = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authorizedFetch(
        `${API_BASE_URL}/admin/dictionaries/${selectedType}/export`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '导出失败');
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedType}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('导出成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setLoading(false);
    }
  };

  // 过滤数据
  const filteredItems = items.filter(item => {
    if (!searchTerm) return true;
    const values = Object.values(item).join(' ').toLowerCase();
    return values.includes(searchTerm.toLowerCase());
  });

  const dictConfig = DICT_TYPES.find(t => t.value === selectedType);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">数据字典管理</h1>
        <p className="text-gray-600 mt-2">创建、编辑和管理系统中的数据字典</p>
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

      {/* 字典类型选择 */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">选择字典类型</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {DICT_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* 工具栏 */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleCreate()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            新建
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && !items.length ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无数据</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {Object.keys(filteredItems[0]).map(key => (
                      <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                        {key}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      {Object.values(item).map((value, idx) => (
                        <td key={idx} className="px-6 py-4 text-sm text-gray-900">
                          {String(value).substring(0, 50)}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          disabled={loading}
                          className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 flex items-center justify-between border-t">
                <p className="text-sm text-gray-600">
                  第 {pagination.page} 页，共 {pagination.totalPages} 页，总计 {pagination.total} 条
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadData(pagination.page - 1)}
                    disabled={pagination.page === 1 || loading}
                    className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => loadData(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages || loading}
                    className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 编辑/创建对话框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? '编辑' : '新建'} {dictConfig?.label}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {Object.keys(formData).map(key => {
                if (key === 'id' || key === 'create_time' || key === 'update_time') return null;
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {key}
                    </label>
                    {key.includes('remark') || key.includes('description') ? (
                      <textarea
                        value={formData[key] || ''}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows={3}
                      />
                    ) : (
                      <input
                        type="text"
                        value={formData[key] || ''}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
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

export default AdminDictionaries;
