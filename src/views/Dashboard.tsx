import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  Activity,
  Radar,
  Share2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../utils';
import { notifyAction } from '../utils/notify';
import { authorizedFetch } from '../utils/authService';

const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL as string | undefined) || 'http://localhost:3001/api';

type DashboardApiData = {
  metrics: {
    total_events_7d: number;
    total_events_30d: number;
    high_risk_events: number;
    coverage_rate: number;
    active_subscriptions: number;
  };
  portrait_stats: {
    total_rows: number;
    total_versions: number;
    last_updated_at: string | null;
  };
  high_risk_stats: {
    critical_count: number;
    warning_count: number;
    total_count: number;
    latest_high_risk_events: Array<{
      id: string;
      title: string;
      description?: string;
      severity: 'critical' | 'warning' | 'info';
      occurred_at?: string;
      created_at?: string;
    }>;
  };
  alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description?: string;
    created_at?: string;
  }>;
  trends: Array<{ date?: string; value: number }>;
  risk_distribution: Array<{ name: string; value: number }>;
  global_risk_index: number | null;
  critical_region_stats?: Array<{ name: string; count: number }>;
  recent_events?: Array<{
    id: string;
    title: string;
    description?: string;
    severity: 'critical' | 'warning' | 'info';
    created_at?: string;
    occurred_at?: string;
    event_locations?: Array<{ location_name?: string }>;
  }>;
};

const initialData: DashboardApiData = {
  metrics: {
    total_events_7d: 0,
    total_events_30d: 0,
    high_risk_events: 0,
    coverage_rate: 0,
    active_subscriptions: 0,
  },
  portrait_stats: {
    total_rows: 0,
    total_versions: 0,
    last_updated_at: null,
  },
  high_risk_stats: {
    critical_count: 0,
    warning_count: 0,
    total_count: 0,
    latest_high_risk_events: [],
  },
  alerts: [],
  trends: [],
  risk_distribution: [],
  global_risk_index: null,
  critical_region_stats: [],
  recent_events: [],
};

function toApiRange(range: '7天' | '30天' | '90天'): '7days' | '30days' | '90days' {
  if (range === '30天') return '30days';
  if (range === '90天') return '90days';
  return '7days';
}

export const Dashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7天' | '30天' | '90天'>('7天');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');
  const [dashboardData, setDashboardData] = useState<DashboardApiData>(initialData);

  const loadDashboard = async (
    range: '7天' | '30天' | '90天',
    options: { silent?: boolean } = {}
  ) => {
    const silent = options.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const ts = Date.now();
      const response = await authorizedFetch(
        `${API_BASE_URL}/dashboard?time_range=${toApiRange(range)}&_t=${ts}`,
        { method: 'GET' }
      );
      const result = await response.json();

      if (!response.ok || !result?.success || !result?.data) {
        throw new Error(result?.error || '工作台数据加载失败');
      }

      setDashboardData({ ...initialData, ...result.data });
      setLastUpdatedAt(new Date().toLocaleTimeString('zh-CN'));
    } catch (loadError: any) {
      console.error('Load dashboard failed:', loadError);
      setError(loadError?.message || '工作台数据加载失败');
      if (!silent) {
        setDashboardData(initialData);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadDashboard(timeRange);
  }, [timeRange]);

  useEffect(() => {
    if (!autoRefresh) return;

    const timer = window.setInterval(() => {
      void loadDashboard(timeRange, { silent: true });
    }, 15000);

    return () => window.clearInterval(timer);
  }, [autoRefresh, timeRange]);

  const trendData = useMemo(() => {
    return (dashboardData.trends || []).map((item, index) => ({
      name: item.date || `第 ${String(index + 1).padStart(2, '0')} 天`,
      value: Number(item.value || 0),
    }));
  }, [dashboardData.trends]);

  const riskDistribution = useMemo(() => {
    const source = dashboardData.risk_distribution || [];
    const total = source.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const colorPalette = ['#adc6ff', '#ffbc7c', '#ff5545', '#4b8eff', '#7dd3fc', '#f59e0b'];

    return source.map((item, index) => {
      const value = Number(item.value || 0);
      const percent = total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
      return {
        name: item.name || '未分类',
        value,
        percent,
        color: colorPalette[index % colorPalette.length],
      };
    });
  }, [dashboardData.risk_distribution]);

  const alerts = dashboardData.alerts || [];
  const recentEvents = dashboardData.recent_events || [];
  const regionStats = dashboardData.critical_region_stats || [];

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">工作台总览</h1>
          <p className="text-[#c1c6d7] font-medium">展示数据库实时汇总的供应链风险态势。</p>
          <p className="text-[#8b90a0] text-xs mt-1">
            自动刷新: {autoRefresh ? '开启 (15秒)' : '关闭'} {lastUpdatedAt ? `· 最近更新 ${lastUpdatedAt}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-[#131b2e] p-1.5 rounded-xl border border-[#414755]/20">
          <div className="flex bg-[#2d3449]/40 rounded-lg p-1">
            {(['7天', '30天', '90天'] as const).map((range) => (
              <button
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  notifyAction(`已切换时间窗口: ${range}`);
                }}
                className={cn(
                  'px-4 py-1.5 text-xs font-bold rounded-md transition-colors',
                  timeRange === range
                    ? 'bg-[#adc6ff] text-[#002e69] shadow-lg'
                    : 'text-[#8b90a0] hover:text-[#dae2fd]'
                )}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={() => void loadDashboard(timeRange)}
            className="flex items-center gap-2 px-3 py-2 bg-[#222a3d] hover:bg-[#2d3449] transition-colors rounded-lg border border-[#414755]/20 text-[#adc6ff]"
            title="刷新真实数据"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-bold">刷新</span>
          </button>
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={cn(
              'px-3 py-2 transition-colors rounded-lg border text-xs font-bold',
              autoRefresh
                ? 'bg-[#adc6ff]/20 text-[#adc6ff] border-[#adc6ff]/30 hover:bg-[#adc6ff]/30'
                : 'bg-[#222a3d] text-[#8b90a0] border-[#414755]/20 hover:text-[#dae2fd]'
            )}
            title="切换自动刷新"
          >
            {autoRefresh ? '实时中' : '已暂停'}
          </button>
        </div>
      </div>

      {loading ? <div className="mb-6 text-sm text-[#8b90a0]">工作台数据加载中...</div> : null}
      {error ? <div className="mb-6 text-sm text-[#ffbc7c]">{error}</div> : null}

      <div className="mb-12 bg-[#131b2e] p-8 rounded-xl border border-[#414755]/10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-[#ff5545]" />
            <h3 className="font-bold text-xl">实时预警通知</h3>
          </div>
          <button
            onClick={() => void loadDashboard(timeRange)}
            className="text-[#adc6ff] text-xs font-bold hover:underline"
          >
            重新拉取
          </button>
        </div>
        {alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts.map((item) => (
              <AlertCard
                key={item.id}
                severity={item.severity}
                title={item.title}
                desc={item.description || '暂无描述'}
                time={item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                onOpen={() => notifyAction(`已打开预警: ${item.title}`)}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-[#8b90a0] py-6">暂无未读预警。</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <MetricCard
          icon={Activity}
          label="事件总量 (30天)"
          value={String(dashboardData.metrics.total_events_30d)}
          change={`7天: ${dashboardData.metrics.total_events_7d}`}
          color="#adc6ff"
        />
        <MetricCard
          icon={AlertTriangle}
          label="高风险事件"
          value={String(dashboardData.metrics.high_risk_events)}
          change="critical+warning"
          color="#ff5545"
        />
        <MetricCard
          icon={Radar}
          label="覆盖率"
          value={`${dashboardData.metrics.coverage_rate}%`}
          change="有地点标注"
          color="#ffbc7c"
        />
        <MetricCard
          icon={Share2}
          label="活跃订阅"
          value={String(dashboardData.metrics.active_subscriptions)}
          change="数据库实时"
          color="#4b8eff"
        />
      </div>

      <div className="mb-12 bg-[#131b2e] p-6 rounded-xl border border-[#414755]/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">产品画像统计</h3>
          <span className="text-xs text-[#8b90a0]">个人维度实时统计</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0b1326] border border-[#414755]/20 rounded-lg p-4">
            <p className="text-xs text-[#8b90a0] mb-1">画像记录数</p>
            <p className="text-2xl font-extrabold text-[#adc6ff]">{dashboardData.portrait_stats.total_rows}</p>
          </div>
          <div className="bg-[#0b1326] border border-[#414755]/20 rounded-lg p-4">
            <p className="text-xs text-[#8b90a0] mb-1">画像版本数</p>
            <p className="text-2xl font-extrabold text-[#ffbc7c]">{dashboardData.portrait_stats.total_versions}</p>
          </div>
          <div className="bg-[#0b1326] border border-[#414755]/20 rounded-lg p-4">
            <p className="text-xs text-[#8b90a0] mb-1">最近画像更新时间</p>
            <p className="text-sm font-bold text-[#dae2fd]">
              {dashboardData.portrait_stats.last_updated_at
                ? new Date(dashboardData.portrait_stats.last_updated_at).toLocaleString()
                : '-'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 mb-12">
        <div className="col-span-12 lg:col-span-8 bg-[#131b2e] p-8 rounded-xl border border-[#414755]/10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="font-bold text-xl mb-1">事件趋势</h3>
              <p className="text-sm text-[#8b90a0]">来自数据库事件表的时间序列。</p>
            </div>
            <button
              onClick={() => notifyAction('趋势基于后端真实统计')}
              className="text-[#adc6ff] text-xs font-bold flex items-center gap-1"
            >
              数据说明 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="h-64">
            {trendData.length === 0 ? (
              <div className="text-sm text-[#8b90a0]">暂无趋势数据</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#adc6ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#adc6ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#414755" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" stroke="#8b90a0" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171f33', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#adc6ff' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#adc6ff" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-[#131b2e] p-8 rounded-xl border border-[#414755]/10 flex flex-col items-center">
          <h3 className="font-bold text-xl mb-2 self-start">风险类型分布</h3>
          <p className="text-xs text-[#8b90a0] self-start mb-4">
            全局风险指数: {dashboardData.global_risk_index ?? '--'}
          </p>
          <div className="relative w-48 h-48 mb-8">
            {riskDistribution.length === 0 ? (
              <div className="text-sm text-[#8b90a0] pt-20 text-center">暂无风险类型数据</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="w-full space-y-3">
            {riskDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-sm font-bold">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 bg-[#131b2e] p-8 rounded-xl border border-[#414755]/10">
          <h3 className="font-bold text-xl mb-6">最新重大事件</h3>
          <div className="space-y-4">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => {
                const date = new Date(event.occurred_at || event.created_at || Date.now());
                const month = `${date.getMonth() + 1}月`;
                const day = String(date.getDate());
                const severityLabel = event.severity === 'critical' ? '紧急' : event.severity === 'warning' ? '预警' : '信息';
                const color = event.severity === 'critical' ? '#ff5545' : event.severity === 'warning' ? '#ffbc7c' : '#adc6ff';
                const location = event.event_locations?.[0]?.location_name || '未标注地点';

                return (
                  <IncidentItem
                    key={event.id}
                    month={month}
                    day={day}
                    title={event.title}
                    desc={`${location} · ${event.description || '暂无描述'}`}
                    severity={severityLabel}
                    time={date.toLocaleString()}
                    color={color}
                  />
                );
              })
            ) : (
              <div className="text-sm text-[#8b90a0]">暂无事件数据</div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 bg-[#131b2e] p-8 rounded-xl border border-[#414755]/10">
          <h3 className="font-bold text-xl mb-6">重点风险区域 Top 5</h3>
          <div className="space-y-6">
            {regionStats.length > 0 ? (
              regionStats.map((region, index) => {
                const max = regionStats[0]?.count || 1;
                const progress = Math.max(5, Math.round((region.count / max) * 100));
                return (
                  <RegionProgress key={`${region.name}-${index}`} label={region.name} count={region.count} progress={progress} />
                );
              })
            ) : (
              <div className="text-sm text-[#8b90a0]">暂无区域统计数据</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AlertCard = ({ severity, title, desc, time, onOpen }: any) => (
  <div
    className={cn(
      'p-4 bg-[#171f33] rounded-lg border-l-4 relative',
      severity === 'critical' ? 'border-[#ff5545]' : severity === 'warning' ? 'border-[#fe9400]' : 'border-[#adc6ff]'
    )}
  >
    <div className="flex justify-between items-start mb-2">
      <span
        className={cn(
          'px-2 py-0.5 text-[10px] font-black rounded uppercase',
          severity === 'critical'
            ? 'bg-[#ff5545]/20 text-[#ff5545]'
            : severity === 'warning'
            ? 'bg-[#fe9400]/20 text-[#fe9400]'
            : 'bg-[#adc6ff]/20 text-[#adc6ff]'
        )}
      >
        {severity === 'critical' ? '危急' : severity === 'warning' ? '预警' : '信息'}
      </span>
      <span className="text-[10px] text-[#414755] font-medium">{time}</span>
    </div>
    <h5 className="font-bold text-sm mb-1">{title}</h5>
    <p className="text-xs text-[#c1c6d7] mb-3">{desc}</p>
    <button onClick={onOpen} className="text-xs text-[#adc6ff] font-bold flex items-center gap-1 hover:gap-2 transition-all">
      查看详情 <ArrowRight className="w-3 h-3" />
    </button>
  </div>
);

const MetricCard = ({ icon: Icon, label, value, change, color }: any) => (
  <div className="bg-[#131b2e] p-6 rounded-xl border border-[#414755]/10 hover:bg-[#222a3d] transition-colors">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
        {change}
      </span>
    </div>
    <h4 className="text-[#414755] text-xs font-bold uppercase tracking-widest mb-1">{label}</h4>
    <div className="text-3xl font-extrabold" style={{ color: label.includes('高风险') ? color : 'inherit' }}>
      {value}
    </div>
  </div>
);

const IncidentItem = ({ month, day, title, desc, severity, time, color }: any) => (
  <div className="group flex items-center justify-between p-4 bg-[#060e20]/50 rounded-lg border-l-4 hover:bg-[#222a3d] transition-colors" style={{ borderLeftColor: color }}>
    <div className="flex gap-4 items-center">
      <div className="flex flex-col items-center justify-center p-2 rounded min-w-[50px]" style={{ backgroundColor: `${color}10`, color }}>
        <span className="text-xs font-black">{month}</span>
        <span className="text-lg font-bold">{day}</span>
      </div>
      <div>
        <h5 className="font-bold text-[#dae2fd]">{title}</h5>
        <p className="text-xs text-[#8b90a0]">{desc}</p>
      </div>
    </div>
    <div className="flex flex-col items-end">
      <span className="px-2 py-0.5 text-[10px] font-black rounded mb-2 uppercase" style={{ backgroundColor: `${color}20`, color }}>
        {severity}
      </span>
      <span className="text-[10px] text-[#8b90a0] italic">{time}</span>
    </div>
  </div>
);

const RegionProgress = ({ label, count, progress }: any) => (
  <div>
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-bold">{label}</span>
      <span className="text-sm text-[#adc6ff] font-black">{count} 起事件</span>
    </div>
    <div className="w-full bg-[#2d3449] h-2 rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-[#adc6ff] to-[#4b8eff]" style={{ width: `${progress}%` }}></div>
    </div>
  </div>
);
