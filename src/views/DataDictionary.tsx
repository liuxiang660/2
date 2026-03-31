import React, { useEffect, useState } from 'react';
import { BarChart3, AlertTriangle, Package, Zap, Globe, TreePine } from 'lucide-react';

interface DictData {
  id: number | string;
  [key: string]: any;
}

interface TreeNode {
  id: number;
  tier1_code?: string;
  tier1_name?: string;
  tier2_code?: string;
  tier2_name?: string;
  [key: string]: any;
  children?: TreeNode[];
}

export const DataDictionary: React.FC = () => {
  const [activeTab, setActiveTab] = useState('products');
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDictionaries();
  }, []);

  const fetchDictionaries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dictionaries/all');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching dictionaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTreeData = async (endpoint: string) => {
    try {
      const response = await fetch(`/api/dictionaries/${endpoint}`);
      const result = await response.json();
      setData((prev) => ({ ...prev, [endpoint]: result }));
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
    }
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const TreeView: React.FC<{ nodes: TreeNode[]; nodeKey?: string }> = ({
    nodes,
    nodeKey = 'id',
  }) => {
    return (
      <div className="space-y-1">
        {nodes.map((node, index) => {
          const id = String(node[nodeKey] || index);
          const hasChildren = node.children && node.children.length > 0;
          const isExpanded = expandedNodes.has(id);

          return (
            <div key={id}>
              <div
                className="flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer rounded"
                onClick={() => hasChildren && toggleNode(id)}
              >
                {hasChildren ? (
                  <span className="text-sm">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                ) : (
                  <span className="text-sm w-4" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {node.tier1_code || node.tier2_code || node.category_code || node.source_code || id}
                  </div>
                  <div className="text-xs text-gray-600">
                    {node.tier1_name || node.tier2_name || node.category_name || node.source_name}
                  </div>
                </div>
              </div>
              {hasChildren && isExpanded && (
                <div className="ml-6 border-l border-gray-200">
                  <TreeView nodes={node.children!} nodeKey={nodeKey} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const TableView: React.FC<{ items: DictData[]; columns: string[] }> = ({
    items,
    columns,
  }) => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {columns.map((col) => (
                <th key={col} className="border border-gray-300 px-4 py-2 text-left text-sm font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={`${idx}-${col}`} className="border border-gray-300 px-4 py-2 text-sm">
                    {String(item[col] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContent = () => {
    if (loading && Object.keys(data).length === 0) {
      return <div className="text-center py-8 text-gray-500">加载中...</div>;
    }

    switch (activeTab) {
      case 'products':
        return (
          <TreeView
            nodes={data.productTier1 || []}
            nodeKey="tier1_code"
          />
        );

      case 'risks':
        return (
          <TreeView
            nodes={data.riskTier1 || []}
            nodeKey="risk_tier1_type_code"
          />
        );

      case 'disasters':
        return (
          <TreeView
            nodes={data.naturalDisaster1 || []}
            nodeKey="tier1_code"
          />
        );

      case 'supplychain':
        return (
          <TreeView
            nodes={data.supplychain1 || []}
            nodeKey="tier1_code"
          />
        );

      case 'regions':
        return (
          <TableView
            items={data.unRegion || []}
            columns={['region_code', 'region_name', 'remark']}
          />
        );

      case 'countries':
        return (
          <TableView
            items={data.country || []}
            columns={['iso2_code', 'iso3_code', 'country_name', 'm49_code']}
          />
        );

      case 'transport':
        return (
          <TableView
            items={data.transportType || []}
            columns={['transport_type_code', 'transport_type_name']}
          />
        );

      case 'media':
        return (
          <TableView
            items={data.mediaSource || []}
            columns={['source_code', 'source_name', 'url', 'remark']}
          />
        );

      default:
        return null;
    }
  };

  const tabConfig = [
    { id: 'products', label: '产品分类', icon: Package },
    { id: 'risks', label: '风险分类', icon: AlertTriangle },
    { id: 'disasters', label: '自然灾害', icon: TreePine },
    { id: 'supplychain', label: '供应链流程', icon: BarChart3 },
    { id: 'regions', label: '地理大区', icon: Globe },
    { id: 'countries', label: '国家', icon: Globe },
    { id: 'transport', label: '运输方式', icon: Zap },
    { id: 'media', label: '媒体来源', icon: BarChart3 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">数据字典管理</h1>
        <p className="text-gray-600 mt-2">查看和管理系统中的所有字典表数据</p>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabConfig.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {renderContent()}
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">产品分类</div>
          <div className="text-2xl font-bold text-gray-900">
            {(data.productTier1 || []).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">风险分类</div>
          <div className="text-2xl font-bold text-gray-900">
            {(data.riskTier1 || []).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">国家/地区</div>
          <div className="text-2xl font-bold text-gray-900">
            {(data.country || []).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">媒体来源</div>
          <div className="text-2xl font-bold text-gray-900">
            {(data.mediaSource || []).length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataDictionary;
