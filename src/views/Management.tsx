import React, { useState } from 'react';
import { 
  User, 
  Shield, 
  Database, 
  Bell, 
  Lock, 
  ChevronRight, 
  Plus,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { cn } from '../utils';

type ManagementTab = 'profile' | 'permissions' | 'dictionary' | 'subscription' | 'rbac';

export const Management: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ManagementTab>('permissions');

  const tabs = [
    { id: 'profile', label: '产品档案配置', icon: Database },
    { id: 'permissions', label: '权限管理', icon: Shield },
    { id: 'dictionary', label: '基础字典', icon: Lock },
    { id: 'subscription', label: '订阅规则', icon: Bell },
    { id: 'rbac', label: 'RBAC 访问控制', icon: User },
  ];

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Internal Sidebar */}
      <aside className="w-64 border-r border-[#414755]/10 bg-[#131b2e]/30 p-6">
        <h2 className="text-lg font-black text-[#adc6ff] mb-8 tracking-tight">管理中心</h2>
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ManagementTab)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all",
                activeTab === tab.id 
                  ? "bg-[#adc6ff] text-[#001a41] shadow-lg shadow-[#adc6ff]/10" 
                  : "text-[#8b90a0] hover:bg-[#2d3449]/50 hover:text-[#dae2fd]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-8 bg-[#0b1326]">
        {activeTab === 'permissions' && <PermissionsView />}
        {activeTab === 'profile' && <div className="text-center py-20 text-[#8b90a0]">产品档案配置模块加载中...</div>}
        {activeTab !== 'permissions' && activeTab !== 'profile' && (
          <div className="text-center py-20 text-[#8b90a0]">该模块正在开发中</div>
        )}
      </main>
    </div>
  );
};

const PermissionsView = () => (
  <div className="max-w-5xl mx-auto">
    <div className="flex justify-between items-center mb-10">
      <div>
        <h2 className="text-3xl font-extrabold text-[#dae2fd] tracking-tight">权限管理</h2>
        <p className="text-[#8b90a0] mt-1">配置用户角色及功能访问权限。</p>
      </div>
      <button className="bg-[#adc6ff] text-[#001a41] px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 hover:brightness-110 transition-all shadow-xl shadow-[#adc6ff]/10">
        <Plus className="w-5 h-5" />
        新增角色
      </button>
    </div>

    {/* Search & Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="md:col-span-2 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#414755]" />
        <input 
          type="text" 
          placeholder="搜索角色名称、描述..." 
          className="w-full bg-[#131b2e] border border-[#414755]/20 rounded-xl py-3 pl-12 pr-4 text-sm text-[#dae2fd] focus:ring-2 focus:ring-[#adc6ff]/50 outline-none transition-all"
        />
      </div>
      <div className="bg-[#131b2e] border border-[#414755]/20 rounded-xl px-6 flex items-center justify-between">
        <span className="text-xs font-bold text-[#8b90a0] uppercase tracking-widest">总角色数</span>
        <span className="text-2xl font-black text-[#adc6ff]">12</span>
      </div>
    </div>

    {/* Roles Table */}
    <div className="bg-[#131b2e] rounded-2xl border border-[#414755]/10 overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-[#222a3d]/50 border-b border-[#414755]/10">
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#8b90a0]">角色名称</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#8b90a0]">成员数量</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#8b90a0]">权限范围</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#8b90a0]">状态</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#8b90a0]">最后更新</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#414755]/10">
          <RoleRow name="超级管理员" count={2} scope="全局所有权限" status="active" date="2023-10-21" />
          <RoleRow name="风险分析师" count={8} scope="工作台, 风险地图, 事件库" status="active" date="2023-10-18" />
          <RoleRow name="供应链主管" count={5} scope="工作台, 供应链拓扑" status="active" date="2023-10-15" />
          <RoleRow name="外部审计员" count={3} scope="只读: 事件库" status="inactive" date="2023-09-28" />
        </tbody>
      </table>
    </div>
  </div>
);

const RoleRow = ({ name, count, scope, status, date }: any) => (
  <tr className="hover:bg-[#222a3d]/30 transition-colors group">
    <td className="px-6 py-5">
      <div className="font-bold text-[#dae2fd]">{name}</div>
    </td>
    <td className="px-6 py-5">
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-6 h-6 rounded-full border-2 border-[#131b2e] bg-[#2d3449] overflow-hidden">
              <img src={`https://picsum.photos/seed/${name}${i}/50/50`} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ))}
        </div>
        <span className="text-xs text-[#8b90a0] font-medium">+{count}</span>
      </div>
    </td>
    <td className="px-6 py-5">
      <div className="text-xs text-[#c1c6d7] font-medium">{scope}</div>
    </td>
    <td className="px-6 py-5">
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase",
        status === 'active' ? "bg-[#adc6ff]/10 text-[#adc6ff]" : "bg-[#414755]/10 text-[#8b90a0]"
      )}>
        {status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        {status === 'active' ? '启用中' : '已禁用'}
      </div>
    </td>
    <td className="px-6 py-5">
      <div className="text-xs text-[#8b90a0] font-mono">{date}</div>
    </td>
    <td className="px-6 py-5 text-right">
      <button className="p-2 text-[#414755] hover:text-[#adc6ff] transition-colors">
        <MoreVertical className="w-5 h-5" />
      </button>
    </td>
  </tr>
);
