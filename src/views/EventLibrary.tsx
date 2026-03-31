import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle,
  Search, 
  Filter, 
  ChevronRight, 
  Download, 
  Save, 
  ChevronLeft, 
  Rss, 
  Newspaper, 
  Shield, 
  Satellite, 
  Cloud,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { cn } from '../utils';
import { notifyAction } from '../utils/notify';
import { toDisplayImageUrl } from '../utils/imageProxy';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const EVENT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#1a2438"/><stop offset="100%" stop-color="#2d3f63"/></linearGradient></defs><rect width="800" height="400" fill="url(#g)"/><circle cx="640" cy="100" r="140" fill="#4b8eff" fill-opacity="0.18"/><circle cx="180" cy="300" r="120" fill="#fe9400" fill-opacity="0.12"/><rect x="300" y="160" width="200" height="80" rx="14" fill="#131b2e" fill-opacity="0.85"/><text x="400" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#dae2fd" font-weight="700">EVENT IMAGE</text></svg>'
  );
const HORMUZ_FALLBACK_IMAGE = 'https://q5.itc.cn/q_70/images03/20260331/0847f53a73a44eeda94453cf9c78ed6f.jpeg';

type EventRow = {
  id: string;
  title: string;
  date: string;
  location: string;
  type: string;
  target: string;
  confidence: number;
  icon: any;
  severity: string;
  // 新增字段
  coverImage?: string;
  keyTakeaway?: string;
  sourceLinks?: string[];
  mediaKeywords?: string[];
  predictedRecoveryDays?: number;
};

function parsePrefillFromHash() {
  const hash = window.location.hash || '#/events';
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) {
    return {
      stage: '所有环节',
      keyword: '',
      risk: '全部等级',
    };
  }

  const query = hash.slice(queryIndex + 1);
  const params = new URLSearchParams(query);

  const stageRaw = params.get('stage') || 'all';
  const riskRaw = params.get('risk') || 'all';

  const stageMap: Record<string, string> = {
    production: '生产制造',
    port: '港口码头',
    warehousing: '仓储配送',
    delivery: '末端派送',
    all: '所有环节',
  };

  const riskMap: Record<string, string> = {
    critical: '极高',
    warning: '中等',
    normal: '低',
    all: '全部等级',
  };

  return {
    stage: stageMap[stageRaw] || '所有环节',
    keyword: params.get('keyword') || '',
    risk: riskMap[riskRaw] || '全部等级',
  };
}

function iconBySeverity(severity: string) {
  if (severity === 'critical') return AlertTriangle;
  if (severity === 'warning') return Rss;
  if (severity === 'info') return Newspaper;
  return Cloud;
}

function mapApiEvent(item: any): EventRow {
  const eventDate = item?.occurred_at || item?.created_at || new Date().toISOString();
  const location = item?.event_locations?.[0]?.location_name || item?.location || '未标注';
  const target =
    item?.event_impacts?.[0]?.supply_chain_stage ||
    item?.event_impacts?.[0]?.affected_area ||
    item?.target ||
    '未标注';
  const type =
    item?.event_impacts?.find((x: any) => x?.impact_type === 'event_type')?.supply_chain_stage ||
    item?.event_type_id ||
    item?.type ||
    '未分类';
  const sourceImage = Array.isArray(item?.event_sources)
    ? item.event_sources
        .map((src: any) => String(src?.source_url || '').trim())
        .find((url: string) => /^https?:\/\//i.test(url) && /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(url)) ||
      item.event_sources
        .map((src: any) => String(src?.source_url || '').trim())
        .find((url: string) => /^https?:\/\//i.test(url)) ||
      ''
    : '';

  const coverImage =
    item?.cover_image ||
    item?.cover_url ||
    item?.image_url ||
    item?.image ||
    sourceImage ||
    (String(item?.title || '').includes('霍尔木兹') ? HORMUZ_FALLBACK_IMAGE : '') ||
    '';

  return {
    id: String(item?.id || ''),
    title: item?.title || '未命名事件',
    date: new Date(eventDate).toISOString().slice(0, 10),
    location,
    type,
    target,
    confidence: Number(item?.confidence_score ?? 0),
    severity: item?.severity || 'info',
    icon: iconBySeverity(item?.severity || 'info'),
    // 新增字段
    coverImage: toDisplayImageUrl(coverImage),
    keyTakeaway: item?.key_takeaway,
    sourceLinks: item?.source_links || [],
    mediaKeywords: item?.media_keywords || [],
    predictedRecoveryDays: item?.predicted_recovery_days,
  };
}

export const EventLibrary: React.FC<{ onEventClick: (id: string) => void }> = ({ onEventClick }) => {
  const prefill = parsePrefillFromHash();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [brokenImageKeys, setBrokenImageKeys] = useState<Record<string, true>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ignoredIds, setIgnoredIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timeRange, setTimeRange] = useState('所有时间');
  const [riskLevel, setRiskLevel] = useState(prefill.risk);
  const [supplyStage, setSupplyStage] = useState(prefill.stage);
  const [confidenceLevel, setConfidenceLevel] = useState('全部');
  const [codeKeyword, setCodeKeyword] = useState(prefill.keyword);
  const pageSize = 5;

  useEffect(() => {
    let mounted = true;

    const loadEvents = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/events?page=1&per_page=500`);
        const result = await response.json();
        if (!mounted) return;
        if (result?.success && result?.data?.items) {
          setEvents(result.data.items.map(mapApiEvent));
        }
      } catch (error) {
        console.error('Load events failed:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadEvents();
    const timer = window.setInterval(() => {
      void loadEvents();
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const filteredEvents = events.filter((event) => {
    if (ignoredIds.includes(event.id)) {
      return false;
    }

    const eventDate = new Date(event.date);
    const dateAnchor = new Date();
    const diffDays = Math.floor((dateAnchor.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));

    if (timeRange === '过去 24 小时' && diffDays > 1) {
      return false;
    }
    if (timeRange === '过去 7 天' && diffDays > 7) {
      return false;
    }
    if (timeRange === '过去 30 天' && diffDays > 30) {
      return false;
    }

    if (riskLevel !== '全部等级') {
      const levelMapping: Record<string, string[]> = {
        极高: ['critical'],
        中等: ['warning', 'info'],
        低: ['neutral'],
      };
      if (!levelMapping[riskLevel]?.includes(event.severity)) {
        return false;
      }
    }

    if (supplyStage !== '所有环节') {
      const stageMapping: Record<string, string[]> = {
        生产制造: ['一级供应商', '电子事业部'],
        港口码头: ['海运物流'],
        仓储配送: ['区域物流'],
        末端派送: ['所有节点'],
      };
      if (!stageMapping[supplyStage]?.includes(event.target)) {
        return false;
      }
    }

    if (confidenceLevel === '高 (90%+)' && event.confidence < 90) {
      return false;
    }
    if (confidenceLevel === '中 (60-89%)' && (event.confidence < 60 || event.confidence > 89)) {
      return false;
    }
    if (confidenceLevel === '低 (<60%)' && event.confidence >= 60) {
      return false;
    }

    if (codeKeyword.trim()) {
      const keyword = codeKeyword.trim().toLowerCase();
      const text = `${event.id} ${event.title} ${event.type} ${event.target}`.toLowerCase();
      if (!text.includes(keyword)) {
        return false;
      }
    }

    return true;
  });

  const visibleEvents = filteredEvents;
  const totalPages = Math.max(1, Math.ceil(visibleEvents.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedEvents = visibleEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? pagedEvents.map((event) => event.id) : []);
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((item) => item !== id)
    );
  };

  const handleSaveSearch = () => {
    localStorage.setItem(
      'event_library_filters',
      JSON.stringify({ page: currentPage, showAdvanced, timeRange, riskLevel, supplyStage, confidenceLevel, codeKeyword })
    );
    notifyAction('当前搜索条件已保存');
  };

  const handleExport = () => {
    const rows = ['id,title,date,location,type,target,confidence'];
    visibleEvents.forEach((event) => {
      rows.push(
        [event.id, event.title, event.date, event.location, event.type, event.target, event.confidence].join(',')
      );
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'event-library.csv';
    a.click();
    URL.revokeObjectURL(url);
    notifyAction('已导出事件库 CSV');
  };

  const markBatch = () => {
    if (selectedIds.length === 0) {
      notifyAction('请先选择要标记的事件');
      return;
    }
    notifyAction(`已标记 ${selectedIds.length} 条事件`);
  };

  const ignoreBatch = () => {
    if (selectedIds.length === 0) {
      notifyAction('请先选择要忽略的事件');
      return;
    }
    setIgnoredIds((prev) => Array.from(new Set([...prev, ...selectedIds])));
    setSelectedIds([]);
    notifyAction('已忽略所选事件');
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-[#dae2fd] tracking-tight">事件库</h1>
          <p className="text-[#c1c6d7] mt-1">全球物流风险事件结构化数据中心。</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSaveSearch}
            className="bg-[#2d3449]/40 border border-[#414755]/15 text-[#adc6ff] px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#2d3449] transition-all"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm font-semibold">保存搜索</span>
          </button>
          <button
            onClick={handleExport}
            className="bg-[#adc6ff] text-[#001a41] px-4 py-2 rounded-lg flex items-center gap-2 font-bold hover:brightness-110 transition-all"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">导出报告</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <section className="bg-[#222a3d]/60 backdrop-blur-md p-6 rounded-xl border border-[#414755]/10 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <FilterSelect label="时间范围" value={timeRange} onChange={setTimeRange} options={['所有时间', '过去 24 小时', '过去 7 天', '过去 30 天']} />
          <FilterSelect label="风险等级" value={riskLevel} onChange={setRiskLevel} options={['全部等级', '极高', '中等', '低']} />
          <FilterSelect label="产业链环节" value={supplyStage} onChange={setSupplyStage} options={['所有环节', '生产制造', '港口码头', '仓储配送', '末端派送']} />
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-[#c1c6d7] font-bold">产品编码 (HS/GPC)</label>
            <input
              className="w-full bg-[#131b2e] border border-[#414755]/20 rounded-lg text-sm text-[#dae2fd] focus:ring-[#adc6ff] focus:border-[#adc6ff] px-3 py-2"
              placeholder="输入编码..."
              type="text"
              value={codeKeyword}
              onChange={(e) => {
                setCodeKeyword(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <FilterSelect label="置信度" value={confidenceLevel} onChange={setConfidenceLevel} options={['全部', '高 (90%+)', '中 (60-89%)', '低 (<60%)']} />
          <div className="flex items-end">
            <button
              onClick={() => {
                setShowAdvanced((prev) => !prev);
                notifyAction(`高级搜索已${showAdvanced ? '收起' : '展开'}`);
              }}
              className="w-full bg-[#2d3449] text-[#adc6ff] font-bold text-sm py-2 rounded-lg border border-[#adc6ff]/20 hover:bg-[#adc6ff]/10 transition-all"
            >
              高级搜索
            </button>
          </div>
        </div>
        {showAdvanced && (
          <div className="mt-4 text-xs text-[#8b90a0] border-t border-[#414755]/20 pt-4">
            可在此扩展来源、地理和产业链联动筛选。
          </div>
        )}
      </section>

      {/* Table */}
      <div className="bg-[#131b2e] rounded-xl overflow-hidden border border-[#414755]/10">
        {loading ? (
          <div className="p-4 text-sm text-[#c1c6d7]">事件加载中...</div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#222a3d]/50 border-b border-[#414755]/10">
                <th className="p-4">
                  <input
                    type="checkbox"
                    checked={pagedEvents.length > 0 && pagedEvents.every((event) => selectedIds.includes(event.id))}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded bg-[#131b2e] border-[#414755] text-[#adc6ff] focus:ring-[#adc6ff]"
                  />
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#c1c6d7]">事件摘要</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#c1c6d7]">发生时间</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#c1c6d7]">地点</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#c1c6d7]">风险类型</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#c1c6d7]">关联对象</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#c1c6d7]">置信度</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#c1c6d7]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#414755]/10">
              {pagedEvents.map((event, idx) => (
                <tr 
                  key={event.id} 
                  onClick={() => onEventClick(event.id)}
                  className={cn(
                    "hover:bg-[#2d3449]/20 transition-colors cursor-pointer",
                    idx % 2 === 1 && "bg-[#060e20]/30"
                  )}
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(event.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => toggleRow(event.id, e.target.checked)}
                      className="rounded bg-[#131b2e] border-[#414755] text-[#adc6ff]"
                    />
                  </td>
                  <td className="p-4">
                    {(() => {
                      const imageSrc = event.coverImage || EVENT_PLACEHOLDER_IMAGE;
                      const imageKey = `${event.id}|${imageSrc}`;
                      const resolvedSrc = brokenImageKeys[imageKey] ? EVENT_PLACEHOLDER_IMAGE : imageSrc;

                      return (
                    <div className="w-20 h-20 mb-2 rounded-lg overflow-hidden border border-[#414755]/20">
                      <img
                        src={resolvedSrc}
                        alt={event.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => {
                          setBrokenImageKeys((prev) => (prev[imageKey] ? prev : { ...prev, [imageKey]: true }));
                        }}
                      />
                    </div>
                      );
                    })()}
                    <div className="font-bold text-sm text-[#dae2fd]">{event.title}</div>
                    <div className="text-[10px] text-[#c1c6d7] mt-0.5">ID: {event.id}</div>
                    {event.mediaKeywords && event.mediaKeywords.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {event.mediaKeywords.slice(0, 2).map((kw: string) => (
                          <span key={kw} className="bg-[#4b8eff]/10 text-[#adc6ff] text-[9px] px-1.5 py-0.5 rounded">
                            {kw}
                          </span>
                        ))}
                        {event.mediaKeywords.length > 2 && (
                          <span className="text-[#8b90a0] text-[9px]">+{event.mediaKeywords.length - 2}更多</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-[#dae2fd]">{event.date}</td>
                  <td className="p-4 text-sm text-[#dae2fd]">{event.location}</td>
                  <td className="p-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-black uppercase",
                      event.severity === 'critical' ? "bg-[#ff5545] text-[#690005]" :
                      event.severity === 'warning' ? "bg-[#fe9400] text-[#4b2800]" :
                      event.severity === 'info' ? "bg-[#4b8eff]/20 text-[#adc6ff] border border-[#adc6ff]/30" :
                      "bg-[#2d3449] text-[#dae2fd]"
                    )}>
                      {event.type}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-[#dae2fd]">{event.target}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1 bg-[#2d3449] rounded-full overflow-hidden">
                        <div className="h-full bg-[#adc6ff]" style={{ width: `${event.confidence}%` }}></div>
                      </div>
                      <span className="text-[10px] font-bold text-[#adc6ff]">{event.confidence}%</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {event.predictedRecoveryDays && (
                        <span className="text-[10px] text-[#fe9400] font-semibold">恢复: {event.predictedRecoveryDays}天</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          notifyAction(`已收藏事件: ${event.id}`);
                        }}
                      >
                        <event.icon className="w-5 h-5 text-[#c1c6d7] cursor-pointer hover:text-[#adc6ff]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 border-t border-[#414755]/10">
          <div className="text-xs text-[#c1c6d7] font-medium">
            当前显示 <span className="text-[#dae2fd]">{pagedEvents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{(currentPage - 1) * pageSize + pagedEvents.length}</span> 条，共 <span className="text-[#dae2fd]">{visibleEvents.length}</span> 条事件
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 text-[#c1c6d7] hover:text-[#adc6ff] transition-all disabled:opacity-30"
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {Array.from({ length: Math.min(3, totalPages) }, (_, index) => index + 1).map((pageNo) => (
              <button
                key={pageNo}
                onClick={() => setPage(pageNo)}
                className={cn(
                  'h-8 w-8 rounded text-xs font-medium transition-all',
                  currentPage === pageNo
                    ? 'bg-[#adc6ff]/20 text-[#adc6ff] border border-[#adc6ff]/30 font-bold'
                    : 'text-[#c1c6d7] hover:bg-[#2d3449]'
                )}
              >
                {pageNo}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-[#c1c6d7] hover:text-[#adc6ff] transition-all disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Batch Actions */}
      <div className="fixed bottom-8 right-8 flex gap-3">
        <div className="bg-[#222a3d]/80 backdrop-blur-lg px-4 py-2 rounded-full border border-[#adc6ff]/20 flex items-center gap-4 shadow-2xl">
          <span className="text-[10px] uppercase font-bold text-[#c1c6d7] tracking-widest border-r border-[#414755]/20 pr-4">批量操作</span>
          <button onClick={markBatch} className="flex items-center gap-2 text-xs font-bold text-[#dae2fd] hover:text-[#adc6ff] transition-colors">
            <CheckCircle className="w-4 h-4" />
            批量标记
          </button>
          <button onClick={ignoreBatch} className="flex items-center gap-2 text-xs font-bold text-[#dae2fd] hover:text-[#ff5545] transition-colors">
            <Trash2 className="w-4 h-4" />
            忽略
          </button>
        </div>
      </div>
    </div>
  );
};

const FilterSelect = ({ label, options, value, onChange }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] uppercase tracking-widest text-[#c1c6d7] font-bold">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#131b2e] border border-[#414755]/20 rounded-lg text-sm text-[#dae2fd] focus:ring-[#adc6ff] focus:border-[#adc6ff] px-3 py-2 appearance-none"
    >
      {options.map((opt: string) => <option key={opt}>{opt}</option>)}
    </select>
  </div>
);
