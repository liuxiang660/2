import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  Printer, 
  MoreHorizontal, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  ExternalLink,
  ChevronRight,
  FileText,
  MessageCircle,
  History,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../utils';
import { notifyAction } from '../utils/notify';
import { downloadTextFile, shareText, copyToClipboard } from '../utils/actions';
import { toDisplayImageUrl } from '../utils/imageProxy';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const EVENT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#1a2438"/><stop offset="100%" stop-color="#2d3f63"/></linearGradient></defs><rect width="800" height="400" fill="url(#g)"/><circle cx="640" cy="100" r="140" fill="#4b8eff" fill-opacity="0.18"/><circle cx="180" cy="300" r="120" fill="#fe9400" fill-opacity="0.12"/><rect x="300" y="160" width="200" height="80" rx="14" fill="#131b2e" fill-opacity="0.85"/><text x="400" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#dae2fd" font-weight="700">EVENT IMAGE</text></svg>'
  );
const HORMUZ_FALLBACK_IMAGE = 'https://q5.itc.cn/q_70/images03/20260331/0847f53a73a44eeda94453cf9c78ed6f.jpeg';

export const EventDetail: React.FC<{ onBack: () => void; eventId?: string | null }> = ({ onBack, eventId }) => {
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventData, setEventData] = useState<any>(null);
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const displayEventId = eventId || 'EVT-UNKNOWN';

  useEffect(() => {
    if (!eventId) {
      setEventData(null);
      setLoadError('未提供事件 ID');
      return;
    }

    let mounted = true;
    setLoading(true);
    setLoadError(null);
    setCoverLoadFailed(false);

    const loadEvent = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}`);
        const result = await response.json();

        if (!mounted) return;

        if (!result?.success || !result?.data) {
          setEventData(null);
          setLoadError(result?.error || '事件详情加载失败');
          return;
        }

        setEventData(result.data);
      } catch (error) {
        if (!mounted) return;
        console.error('Load event detail failed:', error);
        setEventData(null);
        setLoadError('事件详情加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadEvent();

    return () => {
      mounted = false;
    };
  }, [eventId]);

  const detailSeverity = eventData?.severity || 'info';
  const severityLabel =
    detailSeverity === 'critical' ? '严重风险' : detailSeverity === 'warning' ? '中等风险' : '一般风险';
  const detailTitle = eventData?.title || '事件详情';
  const detailLocation = eventData?.event_locations?.[0]?.location_name || '未标注';
  const detailTime = eventData?.occurred_at || eventData?.created_at;
  const detailConfidence = Number(eventData?.confidence_score ?? 0);
  const detailDescription = eventData?.description || '暂无事件描述。';
  const detailTarget =
    eventData?.event_impacts?.find((item: any) => item?.impact_type === 'target')?.supply_chain_stage ||
    '未标注';
  const detailType =
    eventData?.event_impacts?.find((item: any) => item?.impact_type === 'event_type')?.supply_chain_stage ||
    eventData?.event_type_id ||
    '未分类';
  const sourceImage = Array.isArray(eventData?.event_sources)
    ? eventData.event_sources
        .map((src: any) => String(src?.source_url || '').trim())
        .find((url: string) => /^https?:\/\//i.test(url) && /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(url)) ||
      eventData.event_sources
        .map((src: any) => String(src?.source_url || '').trim())
        .find((url: string) => /^https?:\/\//i.test(url)) ||
      ''
    : '';
  const detailCoverImage =
    eventData?.cover_image ||
    eventData?.cover_url ||
    eventData?.image_url ||
    eventData?.image ||
    sourceImage ||
    (String(eventData?.title || '').includes('霍尔木兹') ? HORMUZ_FALLBACK_IMAGE : '') ||
    '';
  const resolvedDetailCoverImage = toDisplayImageUrl(detailCoverImage);
  const resolvedMapImage = toDisplayImageUrl('https://picsum.photos/seed/hamburg/600/400?grayscale');

  const uniqueStrings = (items: unknown[]): string[] => {
    const cleaned = items
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return Array.from(new Set(cleaned));
  };

  const impactedProducts = uniqueStrings([
    ...(eventData?.impact_summary?.products || []),
    ...(eventData?.affected_products || []),
    ...((eventData?.event_product_relation || []).map(
      (item: any) => item?.product_tier3_code_dict?.tier3_name || item?.product_name || item?.product_tier3_id
    )),
    ...((eventData?.event_impacts || [])
      .filter((item: any) => ['product', 'affected_product'].includes(String(item?.impact_type || '').toLowerCase()))
      .map((item: any) => item?.affected_area || item?.estimated_impact)),
  ]).slice(0, 8);

  const impactedRegions = uniqueStrings([
    ...(eventData?.impact_summary?.regions || []),
    ...(eventData?.affected_regions || []),
    ...((eventData?.event_locations || []).map(
      (item: any) => item?.region || item?.location_name || item?.country_code
    )),
    ...((eventData?.event_impacts || [])
      .filter((item: any) => ['region', 'geo', 'target'].includes(String(item?.impact_type || '').toLowerCase()))
      .map((item: any) => item?.affected_area)),
  ]).slice(0, 8);

  const impactedIndustries = uniqueStrings([
    ...(eventData?.impact_summary?.industries || []),
    ...(eventData?.affected_industries || []),
    ...((eventData?.event_impacts || [])
      .filter((item: any) => ['industry', 'sector'].includes(String(item?.impact_type || '').toLowerCase()))
      .map((item: any) => item?.affected_area || item?.estimated_impact)),
  ]).slice(0, 8);

  const derivedDelay =
    eventData?.event_impacts
      ?.find((item: any) => String(item?.impact_type || '').toLowerCase() === 'target')
      ?.estimated_impact || '-';

  const actionHints = uniqueStrings([
    impactedProducts.length > 0 ? `优先确认 ${impactedProducts[0]} 的交付排期与替代料` : '',
    impactedRegions.length > 0 ? `针对 ${impactedRegions[0]} 启动备选路线与仓储兜底` : '',
    impactedIndustries.length > 0 ? `同步 ${impactedIndustries[0]} 相关上下游客户预期` : '',
    eventData?.predicted_recovery_days
      ? `按预计 ${eventData.predicted_recovery_days} 天恢复窗口调整采购节奏`
      : '',
  ]).slice(0, 3);

  const evidenceItems = (eventData?.evidence_chain || [])
    .slice(0, 3)
    .map((item: any, index: number) => {
      const rawTime = item?.created_at || item?.collected_at || eventData?.occurred_at;
      const time = rawTime ? new Date(rawTime).toLocaleString() : '-';
      return {
        time,
        title: item?.content_type || `证据 ${index + 1}`,
        desc: item?.content || '无详情',
        source: item?.hash_value ? `哈希: ${String(item.hash_value).slice(0, 10)}...` : '系统采集',
      };
    });

  const handleShare = async () => {
    const summaryText = `事件 ${displayEventId}：汉堡港口罢工警报：关键物流枢纽受阻`;
    try {
      const mode = await shareText('事件分享', summaryText);
      notifyAction(mode === 'shared' ? '已打开系统分享面板' : '事件标题已复制到剪贴板');
    } catch {
      notifyAction('复制失败，请手动复制');
    }
  };

  // 处理加载中状态
  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#adc6ff] mb-4"></div>
          <p className="text-[#c1c6d7] font-semibold">加载事件详情中...</p>
          <p className="text-[#8b90a0] text-sm mt-2">事件ID: {displayEventId}</p>
        </div>
      </div>
    );
  }

  // 处理错误状态
  if (loadError) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#8b90a0] hover:text-[#adc6ff] transition-colors group mb-6"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold">返回事件库</span>
        </button>
        <div className="bg-[#ff5545]/10 border border-[#ff5545]/30 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-[#ff5545] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#dae2fd] mb-2">加载失败</h2>
          <p className="text-[#c1c6d7] mb-4">{loadError}</p>
          <p className="text-[#8b90a0] text-sm">事件ID: {displayEventId}</p>
          <button
            onClick={onBack}
            className="mt-6 px-6 py-2 bg-[#ff5545] text-white rounded-lg hover:bg-[#ff5545]/80 transition-all"
          >
            返回事件库
          </button>
        </div>
      </div>
    );
  }

  // 处理数据为空的情况（应该不会发生，但作为保险）
  if (!eventData) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#8b90a0] hover:text-[#adc6ff] transition-colors group mb-6"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold">返回事件库</span>
        </button>
        <div className="bg-[#ff5545]/10 border border-[#ff5545]/30 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-[#ff5545] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#dae2fd] mb-2">事件不存在</h2>
          <p className="text-[#c1c6d7] mb-4">无法找到指定的事件详情</p>
          <p className="text-[#8b90a0] text-sm">事件ID: {displayEventId}</p>
          <button
            onClick={onBack}
            className="mt-6 px-6 py-2 bg-[#ff5545] text-white rounded-lg hover:bg-[#ff5545]/80 transition-all"
          >
            返回事件库
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Breadcrumbs & Actions */}
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#8b90a0] hover:text-[#adc6ff] transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold">返回事件库</span>
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="p-2 bg-[#131b2e] border border-[#414755]/20 rounded-lg text-[#8b90a0] hover:text-[#adc6ff] transition-all"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              window.print();
              notifyAction('已触发打印');
            }}
            className="p-2 bg-[#131b2e] border border-[#414755]/20 rounded-lg text-[#8b90a0] hover:text-[#adc6ff] transition-all"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowMoreActions((prev) => !prev)}
            className="p-2 bg-[#131b2e] border border-[#414755]/20 rounded-lg text-[#8b90a0] hover:text-[#adc6ff] transition-all"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showMoreActions && (
        <div className="mb-6 p-3 rounded-lg border border-[#414755]/20 bg-[#131b2e] flex flex-wrap gap-2">
          <button
            onClick={async () => {
              try {
                await copyToClipboard(displayEventId);
                notifyAction(`事件ID ${displayEventId} 已复制`);
              } catch {
                notifyAction('复制事件ID失败');
              }
            }}
            className="px-3 py-1.5 text-xs rounded bg-[#2d3449] text-[#adc6ff]"
          >
            复制事件ID
          </button>
          <button
            onClick={() => {
              downloadTextFile(
                `event-${displayEventId}.txt`,
                `事件ID: ${displayEventId}\n标题: 汉堡港口罢工警报\n地点: 汉堡, 德国\n严重性: 严重风险\n建议: 改道不来梅哈芬港并同步下游工厂`
              );
              notifyAction('事件简报已导出为 TXT');
            }}
            className="px-3 py-1.5 text-xs rounded bg-[#2d3449] text-[#adc6ff]"
          >
            导出简报
          </button>
          <button
            onClick={() => {
              onBack();
              notifyAction('已返回事件库');
            }}
            className="px-3 py-1.5 text-xs rounded bg-[#2d3449] text-[#adc6ff]"
          >
            回到事件库
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-[#131b2e] p-8 rounded-2xl border border-[#414755]/10 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff5545]/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-[#ff5545] text-[#690005] text-[10px] font-black rounded uppercase tracking-widest">{severityLabel}</span>
            <span className="text-xs text-[#8b90a0] font-bold">ID: {displayEventId}</span>
          </div>
          <h1 className="text-4xl font-black text-[#dae2fd] mb-4 tracking-tight">{detailTitle}</h1>
          <div className="flex flex-wrap gap-6 text-sm text-[#c1c6d7]">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#adc6ff]" />
              <span>{detailLocation}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#adc6ff]" />
              <span>发生时间: {detailTime ? new Date(detailTime).toLocaleString() : '未知'}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#adc6ff]" />
              <span>置信度: {detailConfidence}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span>类型: {detailType}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>关联对象: {detailTarget}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Content */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Event Cover Image */}
          <section className="bg-[#131b2e] p-0 rounded-2xl border border-[#414755]/10 overflow-hidden">
            <img
              src={coverLoadFailed ? EVENT_PLACEHOLDER_IMAGE : (resolvedDetailCoverImage || EVENT_PLACEHOLDER_IMAGE)}
              alt={detailTitle}
              className="w-full h-80 object-cover"
              referrerPolicy="no-referrer"
              onError={() => setCoverLoadFailed(true)}
            />
          </section>

          {/* Key Takeaway */}
          {eventData?.key_takeaway && (
            <section className="bg-gradient-to-r from-[#ff5545]/10 to-[#fe9400]/10 p-6 rounded-2xl border border-[#ff5545]/20">
              <h3 className="text-lg font-bold text-[#ffbc7c] mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                关键见解
              </h3>
              <p className="text-[#dae2fd] text-sm leading-relaxed">{eventData.key_takeaway}</p>
            </section>
          )}

          {/* Media Keywords */}
          {eventData?.media_keywords && eventData.media_keywords.length > 0 && (
            <section className="bg-[#131b2e] p-6 rounded-xl border border-[#414755]/10">
              <h4 className="text-sm font-bold text-[#c1c6d7] mb-3 uppercase tracking-widest">相关关键词</h4>
              <div className="flex flex-wrap gap-2">
                {eventData.media_keywords.map((kw: string) => (
                  <span key={kw} className="bg-[#4b8eff]/20 text-[#adc6ff] text-xs px-3 py-1.5 rounded-full border border-[#4b8eff]/30">
                    {kw}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Source Links */}
          {eventData?.source_links && eventData.source_links.length > 0 && (
            <section className="bg-[#131b2e] p-6 rounded-xl border border-[#414755]/10">
              <h4 className="text-sm font-bold text-[#c1c6d7] mb-4 uppercase tracking-widest flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-[#adc6ff]" />
                相关来源 ({eventData.source_links.length})
              </h4>
              <div className="space-y-2">
                {eventData.source_links.map((link: string, idx: number) => (
                  <a
                    key={idx}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-[#060e20] hover:bg-[#131b2e] rounded-lg transition-colors group"
                  >
                    <ExternalLink className="w-4 h-4 text-[#8b90a0] group-hover:text-[#adc6ff]" />
                    <span className="text-sm text-[#8b90a0] group-hover:text-[#adc6ff] truncate font-mono">
                      {link.replace(/^https?:\/\/(www\.)?/, '').substring(0, 60)}...
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Predicted Recovery Days */}
          {eventData?.predicted_recovery_days && (
            <section className="bg-[#131b2e] p-6 rounded-xl border border-[#fe9400]/20">
              <h4 className="text-sm font-bold text-[#c1c6d7] mb-2">预计恢复时间</h4>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-[#fe9400]">{eventData.predicted_recovery_days}</span>
                <span className="text-lg text-[#c1c6d7]">天</span>
              </div>
              <p className="text-xs text-[#8b90a0] mt-2">基于历史数据和当前情况的估计</p>
            </section>
          )}

          <section className="bg-[#131b2e] p-6 rounded-2xl border border-[#414755]/10">
            <h3 className="text-lg font-bold text-[#dae2fd] mb-5">扩展影响面</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#060e20] rounded-xl border border-[#414755]/20 p-4">
                <p className="text-[11px] uppercase tracking-widest text-[#8b90a0] mb-3">影响产品</p>
                <div className="flex flex-wrap gap-2">
                  {impactedProducts.length > 0 ? (
                    impactedProducts.map((item) => (
                      <span key={item} className="px-2.5 py-1 text-xs rounded-full bg-[#4b8eff]/15 text-[#adc6ff] border border-[#4b8eff]/30">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#8b90a0]">暂无产品影响数据</span>
                  )}
                </div>
              </div>

              <div className="bg-[#060e20] rounded-xl border border-[#414755]/20 p-4">
                <p className="text-[11px] uppercase tracking-widest text-[#8b90a0] mb-3">影响地区</p>
                <div className="flex flex-wrap gap-2">
                  {impactedRegions.length > 0 ? (
                    impactedRegions.map((item) => (
                      <span key={item} className="px-2.5 py-1 text-xs rounded-full bg-[#fe9400]/15 text-[#ffbc7c] border border-[#fe9400]/30">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#8b90a0]">暂无地区影响数据</span>
                  )}
                </div>
              </div>

              <div className="bg-[#060e20] rounded-xl border border-[#414755]/20 p-4">
                <p className="text-[11px] uppercase tracking-widest text-[#8b90a0] mb-3">影响行业</p>
                <div className="flex flex-wrap gap-2">
                  {impactedIndustries.length > 0 ? (
                    impactedIndustries.map((item) => (
                      <span key={item} className="px-2.5 py-1 text-xs rounded-full bg-[#ff5545]/15 text-[#ff9f97] border border-[#ff5545]/30">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#8b90a0]">暂无行业影响数据</span>
                  )}
                </div>
              </div>
            </div>
          </section>
          
          {/* Incident Description */}
          <section className="bg-[#131b2e] p-8 rounded-2xl border border-[#414755]/10">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#adc6ff]" />
              事件详情
            </h3>
            <div className="prose prose-invert max-w-none text-[#c1c6d7] leading-relaxed">
              <p>{detailDescription}</p>
            </div>
          </section>

          {/* Evidence Chain / Timeline */}
          <section className="bg-[#131b2e] p-8 rounded-2xl border border-[#414755]/10">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
              <History className="w-5 h-5 text-[#adc6ff]" />
              证据链追踪
            </h3>
            <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[#414755]/30">
              {evidenceItems.length > 0 ? (
                evidenceItems.map((item: any, index: number) => (
                  <TimelineItem
                    key={`${item.time}-${index}`}
                    time={item.time}
                    title={item.title}
                    desc={item.desc}
                    source={item.source}
                    active={index === 0}
                  />
                ))
              ) : (
                <TimelineItem
                  time={detailTime ? new Date(detailTime).toLocaleString() : '-'}
                  title="事件记录"
                  desc={detailDescription}
                  source="事件主记录"
                  active
                />
              )}
            </div>
          </section>

          {/* Similar Events */}
          <section className="bg-[#131b2e] p-8 rounded-2xl border border-[#414755]/10">
            <h3 className="text-xl font-bold mb-6">相似历史事件</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SimilarEventCard title="2022 鹿特丹港大罢工" date="2022-06-12" impact="延误 5 天" onOpen={() => notifyAction('已打开: 2022 鹿特丹港大罢工')} />
              <SimilarEventCard title="2023 安特卫普港口受阻" date="2023-03-15" impact="延误 3 天" onOpen={() => notifyAction('已打开: 2023 安特卫普港口受阻')} />
            </div>
          </section>
        </div>

        {/* Right Column: Analysis & Map */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          {/* Map Thumbnail */}
          <div className="bg-[#131b2e] rounded-2xl border border-[#414755]/10 overflow-hidden">
            <div className="h-48 bg-[#060e20] relative">
              <img 
                src={resolvedMapImage}
                alt="Map" 
                className="w-full h-full object-cover opacity-40"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-[#ff5545] rounded-full animate-ping absolute"></div>
                <MapPin className="w-8 h-8 text-[#ff5545] relative z-10" />
              </div>
              <button
                onClick={() => {
                  window.open('https://www.google.com/maps/search/?api=1&query=Hamburg+Port', '_blank', 'noopener,noreferrer');
                  notifyAction('已在新窗口打开地图定位');
                }}
                className="absolute bottom-3 right-3 p-2 bg-[#131b2e]/80 backdrop-blur-md rounded-lg text-xs font-bold text-[#adc6ff] flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> 全屏查看
              </button>
            </div>
            <div className="p-6">
              <h4 className="font-bold text-[#dae2fd] mb-2">地理位置分析</h4>
              <p className="text-xs text-[#8b90a0] leading-relaxed">
                汉堡港位于易北河下游，是连接中欧与全球贸易的关键节点。当前罢工影响范围覆盖了 100% 的集装箱吞吐能力。
              </p>
            </div>
          </div>

          {/* Impact Analysis */}
          <div className="bg-[#131b2e] p-6 rounded-2xl border border-[#ff5545]/20 shadow-2xl shadow-[#ff5545]/5">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#ff5545]" />
              影响分析
            </h3>
            <div className="space-y-6">
              <ImpactMetric label="物流延误" value={String(derivedDelay)} color="#ff5545" />
              <ImpactMetric label="影响产品数" value={String(impactedProducts.length)} color="#4b8eff" />
              <ImpactMetric label="影响地区数" value={String(impactedRegions.length)} color="#fe9400" />
              <ImpactMetric label="影响行业数" value={String(impactedIndustries.length)} color="#ff9f97" />
            </div>

            <div className="mt-8 pt-6 border-t border-[#414755]/20">
              <h4 className="text-[10px] font-bold text-[#8b90a0] uppercase tracking-widest mb-3">影响范围</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-[#8b90a0] mb-1">产品</p>
                  <div className="flex flex-wrap gap-2">
                    {impactedProducts.slice(0, 3).map((item) => (
                      <span key={`impact-product-${item}`} className="px-2 py-1 text-[10px] rounded-full bg-[#4b8eff]/15 text-[#adc6ff] border border-[#4b8eff]/30">
                        {item}
                      </span>
                    ))}
                    {impactedProducts.length === 0 && <span className="text-[10px] text-[#8b90a0]">暂无</span>}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-[#8b90a0] mb-1">地区</p>
                  <div className="flex flex-wrap gap-2">
                    {impactedRegions.slice(0, 3).map((item) => (
                      <span key={`impact-region-${item}`} className="px-2 py-1 text-[10px] rounded-full bg-[#fe9400]/15 text-[#ffbc7c] border border-[#fe9400]/30">
                        {item}
                      </span>
                    ))}
                    {impactedRegions.length === 0 && <span className="text-[10px] text-[#8b90a0]">暂无</span>}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-[#8b90a0] mb-1">行业</p>
                  <div className="flex flex-wrap gap-2">
                    {impactedIndustries.slice(0, 3).map((item) => (
                      <span key={`impact-industry-${item}`} className="px-2 py-1 text-[10px] rounded-full bg-[#ff5545]/15 text-[#ff9f97] border border-[#ff5545]/30">
                        {item}
                      </span>
                    ))}
                    {impactedIndustries.length === 0 && <span className="text-[10px] text-[#8b90a0]">暂无</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#414755]/20">
              <h4 className="text-[10px] font-bold text-[#8b90a0] uppercase tracking-widest mb-3">建议行动</h4>
              <ul className="space-y-2">
                {actionHints.length > 0 ? (
                  actionHints.map((hint) => (
                    <li key={hint} className="flex items-start gap-2 text-xs text-[#c1c6d7]">
                      <ChevronRight className="w-4 h-4 text-[#adc6ff] shrink-0 mt-0.5" />
                      {hint}
                    </li>
                  ))
                ) : (
                  <li className="flex items-start gap-2 text-xs text-[#c1c6d7]">
                    <ChevronRight className="w-4 h-4 text-[#adc6ff] shrink-0 mt-0.5" />
                    当前暂无可计算的影响项，建议补充产品、地区和行业标签后再评估。
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Expert Chat Simulation */}
          <div className="bg-[#222a3d]/40 p-6 rounded-2xl border border-[#414755]/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#adc6ff] flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-[#001a41]" />
              </div>
              <div>
                <h4 className="font-bold text-sm">智能助手分析</h4>
                <p className="text-[10px] text-[#8b90a0]">实时 AI 研判</p>
              </div>
            </div>
            <p className="text-xs text-[#c1c6d7] italic leading-relaxed">
              "根据历史数据，此类罢工通常在 48 小时内解决，但积压的货物需要额外 1 周时间才能完全消化。建议优先处理高价值订单。"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const TimelineItem = ({ time, title, desc, source, active }: any) => (
  <div className="relative pl-8">
    <div className={cn(
      "absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-[#131b2e] flex items-center justify-center z-10",
      active ? "bg-[#ff5545]" : "bg-[#414755]"
    )}>
      {active && <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>}
    </div>
    <div className="flex justify-between items-start mb-1">
      <h4 className={cn("font-bold text-sm", active ? "text-[#dae2fd]" : "text-[#8b90a0]")}>{title}</h4>
      <span className="text-[10px] font-bold text-[#8b90a0]">{time}</span>
    </div>
    <p className="text-xs text-[#c1c6d7] mb-2">{desc}</p>
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-[#414755] font-bold uppercase tracking-tighter">来源:</span>
      <span className="text-[10px] text-[#adc6ff] font-medium">{source}</span>
    </div>
  </div>
);

const SimilarEventCard = ({ title, date, impact, onOpen }: any) => (
  <button onClick={onOpen} className="w-full text-left p-4 bg-[#171f33] rounded-xl border border-[#414755]/10 hover:border-[#adc6ff]/30 transition-all cursor-pointer group">
    <h5 className="font-bold text-sm text-[#dae2fd] group-hover:text-[#adc6ff] transition-colors mb-1">{title}</h5>
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-[#8b90a0]">{date}</span>
      <span className="text-[10px] font-bold text-[#ffbc7c]">{impact}</span>
    </div>
  </button>
);

const ImpactMetric = ({ label, value, color }: any) => (
  <div>
    <div className="flex justify-between items-end mb-2">
      <span className="text-xs font-bold text-[#8b90a0]">{label}</span>
      <span className="text-xl font-black" style={{ color }}>{value}</span>
    </div>
    <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden">
      <div className="h-full" style={{ backgroundColor: color, width: '70%' }}></div>
    </div>
  </div>
);

const Zap = ({ className }: any) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
