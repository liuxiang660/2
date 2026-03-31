import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Settings,
  RefreshCw,
  ChevronDown,
  MapPin,
  Layers,
  Plus,
  Minus,
  Maximize2,
  Download,
  Save,
  Share2,
  X,
  Calendar,
  Sliders,
  BarChart3,
  Gauge,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../utils';
import { notifyAction } from '../utils/notify';
import { authorizedFetch } from '../utils/authService';
import { downloadCsvFile } from '../utils/actions';

interface RiskEvent {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  remark?: string;
  longitude: number;
  latitude: number;
  loccode: string;
  riskLevel: number;
  riskType: string;
  confidence: number;
  occurredAt: string;
  products?: string[];
}

interface AggregationItem {
  key: string;
  label: string;
  count: number;
  criticalCount: number;
  warningCount: number;
}

interface HeatmapPoint {
  lng: number;
  lat: number;
  weight: number;
  intensity: number;
}

interface HeatmapInspectorPoint extends HeatmapPoint {
  index: number;
}

interface MapView {
  id?: string;
  view_name: string;
  filters: Record<string, any>;
  created_at?: string;
}

const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL as string | undefined) || 'http://localhost:3001/api';

export const RiskMap: React.FC = () => {
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [aggregation, setAggregation] = useState<AggregationItem[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [savedViews, setSavedViews] = useState<MapView[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<RiskEvent | null>(null);
  const [selectedHeatPoint, setSelectedHeatPoint] = useState<HeatmapInspectorPoint | null>(null);
  const [zoomLevel, setZoomLevel] = useState(3);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [focusEventId, setFocusEventId] = useState('');
  const [globalCenter, setGlobalCenter] = useState<[number, number]>([20, 0]);

  // Filter states
  const [keyword, setKeyword] = useState('');
  const [riskLevels, setRiskLevels] = useState<number[]>([]);
  const [confidenceMin, setConfidenceMin] = useState(50);
  const [timeRangeFrom, setTimeRangeFrom] = useState('');
  const [timeRangeTo, setTimeRangeTo] = useState('');
  const [selectedAggregation, setSelectedAggregation] = useState<string | null>(null);
  const [showAggregationDropdown, setShowAggregationDropdown] = useState(false);
  const [viewName, setViewName] = useState('');
  const [layers, setLayers] = useState({
    events: true,
    heatmap: false,
    clustering: true,
  });

  const riskLevelMap = {
    1: { name: '低风险', color: '#adc6ff' },
    2: { name: '中风险', color: '#fe9400' },
    3: { name: '高风险', color: '#ff5545' },
    4: { name: '严重风险', color: '#ff2d2d' },
    5: { name: '极端风险', color: '#cc0000' },
  };

  const openExternalMap = (event: RiskEvent | null) => {
    if (!event) {
      notifyAction('未找到可跳转的事件坐标');
      return;
    }

    const { latitude, longitude, eventTitle } = event;
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    notifyAction(`已打开外部地图: ${eventTitle}`);
  };
  // Load events and aggregation data
  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (riskLevels.length > 0) params.append('riskLevels', riskLevels.join(','));
      if (confidenceMin) params.append('confidenceMin', String(confidenceMin));
      if (timeRangeFrom) params.append('timeRangeFrom', timeRangeFrom);
      if (timeRangeTo) params.append('timeRangeTo', timeRangeTo);
      params.append('limit', '500');
      params.append('offset', '0');

      const [pointsRes, aggRes, heatRes] = await Promise.all([
        authorizedFetch(`${API_BASE_URL}/events/risk-map/points?${params}`),
        authorizedFetch(`${API_BASE_URL}/events/risk-map/aggregation?${params}&groupBy=country`),
        authorizedFetch(`${API_BASE_URL}/events/risk-map/heatmap?${params}`),
      ]);

      const pointsData = await pointsRes.json();
      const aggData = await aggRes.json();
      const heatData = await heatRes.json();

      if (pointsData.success && pointsData.data?.points) {
        setEvents(pointsData.data.points);
      }

      if (aggData.success && aggData.data?.aggregation) {
        setAggregation(aggData.data.aggregation);
      }

      if (heatData.success && heatData.data) {
        setHeatmapData(heatData.data);
      }
    } catch (error) {
      console.error('Failed to load risk map data:', error);
      notifyAction('加载风险地图数据失败');
    } finally {
      setLoading(false);
    }
  };

  // Load saved views
  const loadSavedViews = async () => {
    try {
      const res = await authorizedFetch(`${API_BASE_URL}/events/risk-map/saved-views`);
      const data = await res.json();
      if (data.success) {
        setSavedViews(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load saved views:', error);
    }
  };

  useEffect(() => {
    void loadData();
    void loadSavedViews();
  }, []);

  useEffect(() => {
    if (events.length > 0 && !focusEventId) {
      setFocusEventId(events[0].id);
    }
    if (events.length === 0) {
      setFocusEventId('');
    }
  }, [events, focusEventId]);

  // Filter handler
  const handleFilter = () => {
    setSelectedEvent(null);
    void loadData();
  };

  // Reset filters
  const handleResetFilters = () => {
    setKeyword('');
    setRiskLevels([]);
    setConfidenceMin(50);
    setTimeRangeFrom('');
    setTimeRangeTo('');
    notifyAction('筛选条件已重置');
  };

  // Save view
  const handleSaveView = async () => {
    if (!viewName.trim()) {
      notifyAction('请输入视图名称');
      return;
    }

    try {
      const res = await authorizedFetch(`${API_BASE_URL}/events/risk-map/save-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewName,
          filters: {
            keyword,
            riskLevels,
            confidenceMin,
            timeRangeFrom,
            timeRangeTo,
            selectedAggregation,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        notifyAction(`视图 "${viewName}" 已保存`);
        setViewName('');
        void loadSavedViews();
      }
    } catch (error) {
      console.error('Failed to save view:', error);
      notifyAction('保存视图失败');
    }
  };

  // Export events to CSV
  const handleExportCsv = () => {
    if (events.length === 0) {
      notifyAction('无可导出的事件数据');
      return;
    }

    downloadCsvFile(
      'risk-map-events.csv',
      ['eventTitle', 'riskType', 'riskLevel', 'confidence', 'longitude', 'latitude', 'loccode', 'occurredAt', 'remark'],
      events.map((event) => [
        event.eventTitle,
        event.riskType,
        event.riskLevel,
        event.confidence,
        event.longitude,
        event.latitude,
        event.loccode,
        event.occurredAt,
        event.remark || '',
      ])
    );

    notifyAction(`已导出 ${events.length} 条事件数据`);
  };

  // Risk level toggle
  const toggleRiskLevel = (level: number) => {
    setRiskLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  // Layer toggle
  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
    notifyAction(`${String(layer)} 图层已${!layers[layer] ? '启用' : '关闭'}`);
  };

  const focusOnEvent = (event: RiskEvent | null) => {
    if (!event || !mapInstance) return;
    const target: [number, number] = [event.latitude, event.longitude];
    setGlobalCenter(target);
    mapInstance.flyTo(target, 2, {
      duration: 1.1,
    });
  };

  const handleLocateSelectedEvent = () => {
    if (!focusEventId) {
      notifyAction('请先选择一个事件');
      return;
    }

    const event = events.find((item) => item.id === focusEventId) || null;
    if (!event) {
      notifyAction('未找到对应事件');
      return;
    }

    setSelectedEvent(event);
    setShowDetailPanel(true);
    focusOnEvent(event);
    openExternalMap(event);
  };

  const handleResetView = () => {
    if (!mapInstance) return;
    setGlobalCenter([20, 0]);
    mapInstance.flyTo([20, 0], 2, { duration: 1 });
  };

  const focusOnHeatPoint = (point: HeatmapInspectorPoint | null) => {
    if (!point || !mapInstance) return;
    const target: [number, number] = [point.lat, point.lng];
    setGlobalCenter(target);
    mapInstance.flyTo(target, 2, { duration: 1 });
  };

  // Stats
  const stats = useMemo(() => {
    const critical = events.filter((e) => e.riskLevel >= 4).length;
    const warning = events.filter((e) => e.riskLevel === 3).length;
    const avgConfidence = events.length > 0
      ? Math.round(events.reduce((sum, e) => sum + e.confidence, 0) / events.length)
      : 0;

    return { total: events.length, critical, warning, avgConfidence };
  }, [events]);

  const topHeatPoints = useMemo(
    () =>
      [...heatmapData]
        .sort((a, b) => b.weight * b.intensity - a.weight * a.intensity)
        .slice(0, 6)
        .map((point, index) => ({ ...point, index })),
    [heatmapData]
  );

  const heatmapSummary = useMemo(() => {
    if (heatmapData.length === 0) {
      return {
        maxWeight: 0,
        avgWeight: 0,
      };
    }

    const maxWeight = Math.max(...heatmapData.map((point) => point.weight));
    const avgWeight =
      heatmapData.reduce((sum, point) => sum + point.weight, 0) / heatmapData.length;

    return {
      maxWeight,
      avgWeight,
    };
  }, [heatmapData]);

  const getIntensityLabel = (intensity: number) => {
    if (intensity >= 4) return '高热';
    if (intensity >= 3) return '中热';
    return '低热';
  };

  return (
    <div className="relative h-[calc(100vh-60px)] w-full overflow-hidden flex bg-[#060e20]">
      {loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#000]/40 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#adc6ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[#adc6ff] text-sm font-semibold">加载风险地图中...</p>
          </div>
        </div>
      )}

      {/* Left Workspace Background */}
      <div
        className="absolute left-0 top-0 bottom-0 z-0 w-[360px]"
      >
        <div className="h-full w-full bg-gradient-to-br from-[#0b152b] via-[#0a1325] to-[#070f1f]" />
      </div>

      {/* Interactive Map */}
      <div
        className="absolute md:left-[360px] left-3 right-3 top-3 bottom-3 z-0 bg-[#060e20] border border-[#414755]/25 rounded-l-2xl overflow-hidden shadow-2xl"
      >
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a1325] to-transparent pointer-events-none z-[400]" />
        <MapContainer
          center={globalCenter}
          zoom={2}
          minZoom={2}
          maxZoom={2}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          boxZoom={false}
          keyboard={false}
          dragging={false}
          zoomControl={false}
          className="w-full h-full"
          ref={(instance) => {
            if (instance && instance !== mapInstance) {
              setMapInstance(instance);
            }
          }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {layers.heatmap &&
            heatmapData.map((point, idx) => (
              <Circle
                key={`heat-${idx}`}
                center={[point.lat, point.lng]}
                radius={Math.max(12000, point.weight * 120000)}
                pathOptions={{
                  color: '#ff5545',
                  fillColor: '#ff5545',
                  fillOpacity: Math.min(0.45, 0.1 + point.weight * 0.25),
                  weight: 0,
                }}
                eventHandlers={{
                  click: () => {
                    const target = { ...point, index: idx };
                    setSelectedHeatPoint(target);
                    focusOnHeatPoint(target);
                  },
                }}
              />
            ))}

          {layers.events &&
            events.map((event) => {
              const color = riskLevelMap[event.riskLevel as keyof typeof riskLevelMap]?.color || '#adc6ff';
              return (
                <CircleMarker
                  key={event.id}
                  center={[event.latitude, event.longitude]}
                  radius={selectedEvent?.id === event.id ? 9 : 6}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 1,
                    fillColor: color,
                    fillOpacity: 0.95,
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedEvent(event);
                      setShowDetailPanel(true);
                      focusOnEvent(event);
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>
                    {event.eventTitle}
                  </Tooltip>
                </CircleMarker>
              );
            })}
        </MapContainer>
      </div>

      {/* Left Filters Panel */}
      <div
        className="absolute left-6 top-6 z-20 w-80 max-w-[320px] max-h-[calc(100vh-100px)] flex flex-col gap-3 overflow-y-auto"
      >
        <div className="bg-[#222a3d]/60 backdrop-blur-xl p-5 rounded-xl border border-[#414755]/10 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#dae2fd] text-sm">筛选条件</h3>
            <button
              onClick={handleResetFilters}
              className="text-[10px] text-[#adc6ff] hover:text-white transition-colors"
            >
              重置
            </button>
          </div>

          <div className="space-y-4">
            {/* Keyword */}
            <div>
              <label className="text-[10px] font-bold text-[#8b90a0] uppercase tracking-wider block mb-2">
                关键词搜索
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="事件标题/描述..."
                className="w-full bg-[#060e20] border border-[#414755]/20 rounded-lg text-sm text-[#dae2fd] py-2 px-3 placeholder-[#8b90a0]"
              />
            </div>

            {/* Risk Levels */}
            <div>
              <label className="text-[10px] font-bold text-[#8b90a0] uppercase tracking-wider block mb-2">
                风险等级
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(riskLevelMap) as [string, any][]).map(([level, { name, color }]) => (
                  <button
                    key={level}
                    onClick={() => toggleRiskLevel(Number(level))}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      riskLevels.includes(Number(level))
                        ? 'bg-[#adc6ff]/10 text-[#adc6ff] border-[#adc6ff]/30'
                        : 'bg-[#2d3449] text-[#8b90a0] border-transparent'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div>
              <label className="text-[10px] font-bold text-[#8b90a0] uppercase tracking-wider block mb-2">
                置信度最小值: {confidenceMin}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={confidenceMin}
                onChange={(e) => setConfidenceMin(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Time Range */}
            <div>
              <label className="text-[10px] font-bold text-[#8b90a0] uppercase tracking-wider block mb-2">
                时间范围
              </label>
              <input
                type="date"
                value={timeRangeFrom}
                onChange={(e) => setTimeRangeFrom(e.target.value)}
                className="w-full bg-[#060e20] border border-[#414755]/20 rounded-lg text-sm text-[#dae2fd] py-2 px-3 mb-2"
              />
              <input
                type="date"
                value={timeRangeTo}
                onChange={(e) => setTimeRangeTo(e.target.value)}
                className="w-full bg-[#060e20] border border-[#414755]/20 rounded-lg text-sm text-[#dae2fd] py-2 px-3"
              />
            </div>

            {/* Layers */}
            <div>
              <label className="text-[10px] font-bold text-[#8b90a0] uppercase tracking-wider block mb-2">
                图层显示
              </label>
              <div className="space-y-2">
                {(
                  [
                    { key: 'events' as const, label: '风险事件点' },
                    { key: 'heatmap' as const, label: '热力图' },
                    { key: 'clustering' as const, label: '聚类' },
                  ] as const
                ).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#2d3449]/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layers[key]}
                      onChange={(e) => toggleLayer(key)}
                      className="rounded border-[#414755] text-[#adc6ff]"
                    />
                    <span className="text-sm text-[#c1c6d7]">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Apply Button */}
            <button
              onClick={handleFilter}
              className="w-full py-2 rounded-lg bg-[#adc6ff] text-[#001a41] font-bold text-sm hover:bg-[#c1d4ff] transition-colors"
            >
              应用筛选
            </button>
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-[#222a3d]/60 backdrop-blur-xl p-4 rounded-xl border border-[#414755]/10">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-[#8b90a0] uppercase">总数</p>
              <p className="text-xl font-extrabold text-[#adc6ff]">{stats.total}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#8b90a0] uppercase">高风险</p>
              <p className="text-xl font-extrabold text-[#ff5545]">{stats.critical}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#8b90a0] uppercase">预警</p>
              <p className="text-xl font-extrabold text-[#fe9400]">{stats.warning}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#8b90a0] uppercase">平均置信</p>
              <p className="text-xl font-extrabold text-[#adc6ff]">{stats.avgConfidence}%</p>
            </div>
          </div>
        </div>

        {/* Regional Distribution */}
        {aggregation.length > 0 && (
          <div className="bg-[#222a3d]/60 backdrop-blur-xl p-4 rounded-xl border border-[#414755]/10">
            <h4 className="font-bold text-[#dae2fd] text-sm mb-3">地区分布 TOP5</h4>
            <div className="space-y-2">
              {aggregation.slice(0, 5).map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="text-xs text-[#8b90a0] flex-1">{item.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[#414755]/30 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#adc6ff] to-[#ff5545]"
                      style={{ width: `${Math.min(100, (item.count / (aggregation[0]?.count || 1)) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-[#adc6ff] w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top Right Buttons */}
      <div className="absolute right-6 top-6 z-20 flex gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#222a3d]/75 backdrop-blur-xl border border-[#414755]/20 rounded-lg">
          <select
            value={focusEventId}
            onChange={(e) => setFocusEventId(e.target.value)}
            className="max-w-[220px] bg-[#060e20] border border-[#414755]/30 rounded-md text-xs text-[#dae2fd] py-1.5 px-2"
          >
            <option value="">选择事件定位</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.eventTitle}
              </option>
            ))}
          </select>
          <button
            onClick={handleLocateSelectedEvent}
            className="px-3 py-1.5 bg-[#adc6ff] text-[#001a41] rounded-md font-semibold text-xs hover:bg-[#c1d4ff] transition-colors"
          >
            定位
          </button>
          <button
            onClick={handleResetView}
            className="px-3 py-1.5 bg-[#2d3449] text-[#adc6ff] rounded-md font-semibold text-xs hover:bg-[#3b445d] transition-colors"
          >
            全图
          </button>
        </div>
        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-[#adc6ff] text-[#001a41] rounded-lg font-semibold text-sm hover:bg-[#c1d4ff] transition-colors"
        >
          导出 CSV
        </button>
        <button
          onClick={() => {
            if (!layers.heatmap) {
              toggleLayer('heatmap');
            }
            if (topHeatPoints[0]) {
              setSelectedHeatPoint(topHeatPoints[0]);
              focusOnHeatPoint(topHeatPoints[0]);
            }
          }}
          className="px-4 py-2 bg-[#ff5545]/20 backdrop-blur-xl border border-[#ff5545]/20 text-[#ff9d95] rounded-lg font-semibold text-sm hover:bg-[#ff5545]/30 transition-colors"
        >
          查看热点
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-[#222a3d]/60 backdrop-blur-xl border border-[#414755]/10 text-[#adc6ff] rounded-lg font-semibold text-sm hover:bg-[#2d3449] transition-colors"
        >
          {showFilters ? '收起' : '展开'}筛选
        </button>
      </div>

      {/* Detail Panel */}
      {showDetailPanel && selectedEvent && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-[#000]/40 backdrop-blur-sm p-4"
          onClick={() => setShowDetailPanel(false)}
        >
          <div
            className="bg-[#222a3d]/80 backdrop-blur-xl rounded-xl border border-[#414755]/10 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#dae2fd] mb-2">{selectedEvent.eventTitle}</h2>
                <div className="flex gap-3">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: `${riskLevelMap[selectedEvent.riskLevel as keyof typeof riskLevelMap]?.color || '#adc6ff'}20`,
                      color: riskLevelMap[selectedEvent.riskLevel as keyof typeof riskLevelMap]?.color || '#adc6ff',
                    }}
                  >
                    {riskLevelMap[selectedEvent.riskLevel as keyof typeof riskLevelMap]?.name}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#adc6ff]/20 text-[#adc6ff]">
                    置信度: {selectedEvent.confidence}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDetailPanel(false)}
                className="text-2xl text-[#8b90a0] hover:text-[#dae2fd] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-[#8b90a0] uppercase mb-1 block">

                  位置
                </label>
                <p className="text-sm text-[#c1c6d7]">
                  {selectedEvent.latitude.toFixed(4)}°, {selectedEvent.longitude.toFixed(4)}°
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8b90a0] uppercase mb-1 block">
                  地点代码
                </label>
                <p className="text-sm text-[#c1c6d7]">{selectedEvent.loccode}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8b90a0] uppercase mb-1 block">
                  发生时间
                </label>
                <p className="text-sm text-[#c1c6d7]">
                  {new Date(selectedEvent.occurredAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8b90a0] uppercase mb-1 block">
                  影响产品
                </label>
                <p className="text-sm text-[#c1c6d7]">{selectedEvent.products?.join(', ') || '无'}</p>
              </div>
            </div>

            {selectedEvent.remark && (
              <div className="p-4 bg-[#131b2e] rounded-lg mb-6 border border-[#414755]/20">
                <label className="text-[10px] font-bold text-[#8b90a0] uppercase mb-2 block">
                  备注
                </label>
                <p className="text-sm text-[#c1c6d7]">{selectedEvent.remark}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  focusOnEvent(selectedEvent);
                  openExternalMap(selectedEvent);
                }}
                className="flex-1 py-2 rounded-lg bg-[#ff5545]/10 text-[#ff9d95] font-semibold hover:bg-[#ff5545]/20 transition-colors"
              >
                地图定位（外部）
              </button>
              <button
                onClick={() => setShowDetailPanel(false)}
                className="flex-1 py-2 rounded-lg bg-[#adc6ff]/10 text-[#adc6ff] font-semibold hover:bg-[#adc6ff]/20 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Heatmap Viewer */}
      {layers.heatmap && heatmapData.length > 0 && (
        <div className="absolute right-6 top-24 z-20 w-72 bg-[#222a3d]/75 backdrop-blur-xl p-4 rounded-xl border border-[#ff5545]/20 shadow-2xl">
          <h4 className="font-bold text-[#ffd8d4] text-sm mb-3">热力图查看</h4>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-[#060e20] border border-[#414755]/20 p-2">
              <p className="text-[10px] text-[#8b90a0] uppercase">热点数</p>
              <p className="text-sm font-bold text-[#ff9d95]">{heatmapData.length}</p>
            </div>
            <div className="rounded-lg bg-[#060e20] border border-[#414755]/20 p-2">
              <p className="text-[10px] text-[#8b90a0] uppercase">峰值</p>
              <p className="text-sm font-bold text-[#ff9d95]">{heatmapSummary.maxWeight.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-[#060e20] border border-[#414755]/20 p-2">
              <p className="text-[10px] text-[#8b90a0] uppercase">均值</p>
              <p className="text-sm font-bold text-[#ff9d95]">{heatmapSummary.avgWeight.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-2 max-h-44 overflow-y-auto">
            {topHeatPoints.map((point) => {
              const active = selectedHeatPoint?.index === point.index;
              return (
                <button
                  key={`heat-list-${point.index}`}
                  onClick={() => {
                    setSelectedHeatPoint(point);
                    focusOnHeatPoint(point);
                  }}
                  className={cn(
                    'w-full text-left rounded-lg border p-2 transition-colors',
                    active
                      ? 'border-[#ff5545]/60 bg-[#ff5545]/15'
                      : 'border-[#414755]/20 bg-[#060e20] hover:bg-[#131b2e]'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#ffd8d4]">热点 #{point.index + 1}</span>
                    <span className="text-[10px] text-[#ff9d95]">{getIntensityLabel(point.intensity)}</span>
                  </div>
                  <p className="text-[11px] text-[#c1c6d7]">
                    {point.lat.toFixed(2)}°, {point.lng.toFixed(2)}°
                  </p>
                  <p className="text-[11px] text-[#8b90a0]">
                    权重 {point.weight.toFixed(2)} · 强度 {point.intensity}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap Detail Panel */}
      {selectedHeatPoint && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-[#000]/40 backdrop-blur-sm p-4"
          onClick={() => setSelectedHeatPoint(null)}
        >
          <div
            className="bg-[#222a3d]/80 backdrop-blur-xl rounded-xl border border-[#ff5545]/20 p-6 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-bold text-[#ffd8d4]">热力点详情</h2>
              <button
                onClick={() => setSelectedHeatPoint(null)}
                className="text-xl text-[#8b90a0] hover:text-[#dae2fd] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="rounded-lg bg-[#060e20] border border-[#414755]/20 p-3">
                <p className="text-[10px] text-[#8b90a0] uppercase">纬度</p>
                <p className="text-sm font-semibold text-[#ffd8d4]">{selectedHeatPoint.lat.toFixed(4)}°</p>
              </div>
              <div className="rounded-lg bg-[#060e20] border border-[#414755]/20 p-3">
                <p className="text-[10px] text-[#8b90a0] uppercase">经度</p>
                <p className="text-sm font-semibold text-[#ffd8d4]">{selectedHeatPoint.lng.toFixed(4)}°</p>
              </div>
              <div className="rounded-lg bg-[#060e20] border border-[#414755]/20 p-3">
                <p className="text-[10px] text-[#8b90a0] uppercase">热力权重</p>
                <p className="text-sm font-semibold text-[#ffd8d4]">{selectedHeatPoint.weight.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-[#060e20] border border-[#414755]/20 p-3">
                <p className="text-[10px] text-[#8b90a0] uppercase">风险强度</p>
                <p className="text-sm font-semibold text-[#ffd8d4]">
                  {selectedHeatPoint.intensity} ({getIntensityLabel(selectedHeatPoint.intensity)})
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => focusOnHeatPoint(selectedHeatPoint)}
                className="flex-1 py-2 rounded-lg bg-[#ff5545]/15 text-[#ff9d95] font-semibold hover:bg-[#ff5545]/25 transition-colors"
              >
                地图定位
              </button>
              <button
                onClick={() => setSelectedHeatPoint(null)}
                className="flex-1 py-2 rounded-lg bg-[#adc6ff]/10 text-[#adc6ff] font-semibold hover:bg-[#adc6ff]/20 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save View Modal */}
      {showFilters && (
        <div className="absolute bottom-6 right-6 z-20 bg-[#222a3d]/60 backdrop-blur-xl p-4 rounded-xl border border-[#414755]/10 w-64">
          <label className="text-[10px] font-bold text-[#8b90a0] uppercase block mb-2">
            保存视图名称
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="输入视图名..."
              className="flex-1 bg-[#060e20] border border-[#414755]/20 rounded-lg text-sm text-[#dae2fd] py-2 px-3 placeholder-[#8b90a0]"
            />
            <button
              onClick={handleSaveView}
              className="px-3 py-2 bg-[#adc6ff] text-[#001a41] rounded-lg font-bold text-xs hover:bg-[#c1d4ff] transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
