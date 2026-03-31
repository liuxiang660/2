import React, { useEffect, useMemo, useState } from 'react';
import { 
  Database, 
  Truck, 
  Factory, 
  Search,
  GitBranch,
  Gauge,
  ArrowRight,
  Activity,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { cn } from '../utils';
import { notifyAction } from '../utils/notify';
import { downloadCsvFile, downloadTextFile } from '../utils/actions';
import { authorizedFetch } from '../utils/authService';

type NodeStatus = 'normal' | 'warning' | 'critical';

interface ChainNode {
  id?: number;
  label: string;
  status: NodeStatus;
  code: string;
  tier3Code?: string | null;
  tier3Name?: string | null;
  delay: string;
  delayHours?: number | null;
  riskLevel?: number | null;
  upstreamCount?: number;
  downstreamCount?: number;
  affectedOrders: number;
  incident: string;
}

interface ChainRelation {
  id: number;
  upstreamNodeId: number;
  downstreamNodeId: number;
  relationType?: string | null;
  remark?: string;
}

interface EventData {
  id: string | number;
  title: string;
  description: string;
  severity?: 'critical' | 'warning' | 'info';
  confidenceScore?: number;
  occurred_at?: string;
  event_impacts?: Array<{
    impact_type?: string;
    estimated_impact?: string;
    supply_chain_stage?: string;
    recovery_days?: number;
  }>;
  event_risk_relations?: any[];
  affected_products?: Array<{ tier3Code?: string; tier3Name?: string }>;
  event_locations?: Array<{ location_name?: string; region?: string }>;
}

type StatusFilter = 'all' | NodeStatus;

interface NodeRiskStat {
  eventCount: number;
  topRiskType: string;
}

const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL as string | undefined) || 'http://localhost:3001/api';

const fallbackChainNodes: ChainNode[] = [
  {
    label: '原材料 A',
    status: 'normal',
    code: 'RAW-A',
    delay: '0h',
    affectedOrders: 12,
    incident: '供应稳定，库存健康。',
  },
  {
    label: '原材料 B',
    status: 'normal',
    code: 'RAW-B',
    delay: '4h',
    affectedOrders: 28,
    incident: '轻微运输拥堵，影响可控。',
  },
  {
    label: '核心组件厂',
    status: 'warning',
    code: 'CMP-01',
    delay: '24h',
    affectedOrders: 76,
    incident: '工位检修导致产线降速。',
  },
  {
    label: '鹿特丹港',
    status: 'critical',
    code: 'NLD-RTD',
    delay: '72h+',
    affectedOrders: 142,
    incident: '港口工人无限期罢工，所有出口作业已停止。',
  },
  {
    label: '新加坡港',
    status: 'normal',
    code: 'SG-SIN',
    delay: '8h',
    affectedOrders: 35,
    incident: '台风影响已消退，正在恢复排队吞吐。',
  },
  {
    label: '区域分拨中心',
    status: 'normal',
    code: 'WH-CN-01',
    delay: '2h',
    affectedOrders: 20,
    incident: '末端派送正常。',
  },
];

const fallbackMaterials = [
  { name: '高性能锂电池', code: 'BAT-001', impact: 'High', status: 'Delay' },
  { name: '精密传感器', code: 'SEN-X2', impact: 'Medium', status: 'Normal' },
  { name: '铝合金外壳', code: 'CAS-AL', impact: 'Low', status: 'Normal' },
];

const statusText: Record<NodeStatus, string> = {
  normal: '正常',
  warning: '预警',
  critical: '中断',
};

function inferStageName(node: ChainNode): string {
  const text = `${node.label} ${node.code}`.toLowerCase();
  if (text.includes('港') || text.includes('port')) return '港口码头';
  if (text.includes('仓') || text.includes('物流') || text.includes('配送') || text.includes('wh-')) return '仓储配送';
  if (text.includes('厂') || text.includes('组件') || text.includes('制造') || text.includes('cmp')) return '生产制造';
  if ((node.upstreamCount || 0) === 0) return '生产制造';
  if ((node.downstreamCount || 0) === 0) return '末端派送';
  return '仓储配送';
}

function inferRegionEntity(node: ChainNode): string {
  const text = `${node.label} ${node.incident}`;
  const hit = text.match(/(新加坡|鹿特丹|中国|欧洲|北美|亚太|华东|华南)/);
  return hit?.[1] || node.label;
}

function stageToEventLibraryParam(stage: string): string {
  if (stage === '生产制造') return 'production';
  if (stage === '港口码头') return 'port';
  if (stage === '仓储配送') return 'warehousing';
  if (stage === '末端派送') return 'delivery';
  return 'all';
}

function statusToRiskParam(status: NodeStatus): string {
  if (status === 'critical') return 'critical';
  if (status === 'warning') return 'warning';
  return 'normal';
}

export const SupplyChainView: React.FC = () => {
  const [chainNodes, setChainNodes] = useState<ChainNode[]>(fallbackChainNodes);
  const [relations, setRelations] = useState<ChainRelation[]>([]);
  const [nodeRiskStats, setNodeRiskStats] = useState<Map<number, NodeRiskStat>>(new Map());
  const [selectedNode, setSelectedNode] = useState<ChainNode>(fallbackChainNodes[3]);
  const [eventList, setEventList] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [onlyRiskLinks, setOnlyRiskLinks] = useState(false);
  const [relationTypeFilter, setRelationTypeFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;

    const loadTopology = async () => {
      try {
        const response = await authorizedFetch(`${API_BASE_URL}/dictionaries/supplychain-topology`);
        const result = await response.json();

        if (!response.ok || !result?.success || !result?.data?.nodes) {
          throw new Error(result?.error || '供应链拓扑读取失败');
        }

        if (cancelled) {
          return;
        }

        const mappedNodes: ChainNode[] = (result.data.nodes as any[]).map((node) => {
          const downstreamCount = Number(node.downstreamCount || 0);
          const upstreamCount = Number(node.upstreamCount || 0);
          const affectedOrders = downstreamCount * 23 + upstreamCount * 11;
          const delayHours = node.delayHours !== null && node.delayHours !== undefined ? Number(node.delayHours) : null;

          const delayText = delayHours === null
            ? node.status === 'critical'
              ? '48h+'
              : node.status === 'warning'
              ? '12h'
              : '0h'
            : delayHours >= 48
            ? `${delayHours}h+`
            : `${delayHours}h`;

          return {
            id: Number(node.id),
            label: node.nodeName || `节点-${node.nodeCode}`,
            status: (node.status as NodeStatus) || 'normal',
            code: node.nodeCode || '-',
            tier3Code: node.tier3Code || null,
            tier3Name: node.tier3Name || null,
            delay: delayText,
            delayHours,
            riskLevel: node.riskLevel !== null && node.riskLevel !== undefined ? Number(node.riskLevel) : null,
            upstreamCount: Number(node.upstreamCount || 0),
            downstreamCount: Number(node.downstreamCount || 0),
            affectedOrders,
            incident: node.remark || '节点运行稳定',
          };
        });

        const mappedRelations: ChainRelation[] = (result.data.relations || []).map((relation: any) => ({
          id: Number(relation.id),
          upstreamNodeId: Number(relation.upstreamNodeId),
          downstreamNodeId: Number(relation.downstreamNodeId),
          relationType: relation.relationType || null,
          remark: relation.remark || '',
        }));

        if (mappedNodes.length > 0) {
          setChainNodes(mappedNodes);
          setRelations(mappedRelations);

          const preferredNode = mappedNodes.find((n) => n.status === 'critical') || mappedNodes[0];
          setSelectedNode(preferredNode);
        }
      } catch (error) {
        console.error('Load supply chain topology failed:', error);
        notifyAction('供应链拓扑读取失败，已展示默认拓扑');
      }
    };

    void loadTopology();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      try {
        const response = await authorizedFetch(`${API_BASE_URL}/events?page=1&per_page=200`);
        const result = await response.json();

        if (!response.ok || !result?.success || !result?.data?.items) {
          return;
        }

        if (cancelled) return;

        const events = (result.data.items as any[]).map((event) => {
          // 将 event_product_relation 映射为 affected_products
          const affected_products = (event.event_product_relation || []).map((rel: any) => ({
            tier3Code: rel.product_tier3_code_dict?.tier3_code,
            tier3Name: rel.product_tier3_code_dict?.tier3_name,
          }));

          // 调试日志 - 所有事件
          console.log('[Event Loaded]', event.title, {
            event_product_relation: event.event_product_relation,
            affected_products,
            event_impacts: event.event_impacts?.map(e => ({ type: e.impact_type, stage: e.supply_chain_stage })) || [],
          });

          return {
            ...event,
            affected_products,
          } as EventData;
        }).sort((a, b) => {
          const aTime = new Date(a.occurred_at || 0).getTime();
          const bTime = new Date(b.occurred_at || 0).getTime();
          return bTime - aTime;
        });

        setEventList(events);
        if (events.length > 0) {
          setSelectedEvent(events[0]);
        }
      } catch (error) {
        console.error('Load events failed:', error);
      }
    };

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadNodeRiskStats = async () => {
      try {
        const response = await authorizedFetch(`${API_BASE_URL}/events?page=1&per_page=500`);
        const result = await response.json();

        if (!response.ok || !result?.success || !result?.data?.items) {
          return;
        }

        const stats = new Map<number, { eventCount: number; typeCount: Map<string, number> }>();
        const nodes = chainNodes.filter((node) => typeof node.id === 'number');

        (result.data.items as any[]).forEach((event) => {
          const location = String(event?.event_locations?.[0]?.location_name || event?.location || '').toLowerCase();
          const target = String(event?.event_impacts?.[0]?.supply_chain_stage || event?.target || '').toLowerCase();
          const title = String(event?.title || '').toLowerCase();
          const eventText = `${location} ${target} ${title}`;
          const riskType = String(
            event?.event_impacts?.find((x: any) => x?.impact_type === 'event_type')?.supply_chain_stage
            || event?.event_type_id
            || event?.type
            || '未分类'
          );

          nodes.forEach((node) => {
            const keys = [node.label, node.code]
              .map((item) => item.toLowerCase())
              .filter(Boolean);

            if (!keys.some((key) => eventText.includes(key))) {
              return;
            }

            const nodeId = Number(node.id);
            if (!stats.has(nodeId)) {
              stats.set(nodeId, { eventCount: 0, typeCount: new Map() });
            }

            const row = stats.get(nodeId)!;
            row.eventCount += 1;
            row.typeCount.set(riskType, (row.typeCount.get(riskType) || 0) + 1);
          });
        });

        if (cancelled) {
          return;
        }

        const compactStats = new Map<number, NodeRiskStat>();
        stats.forEach((value, nodeId) => {
          const topRiskType = Array.from(value.typeCount.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || '未分类';

          compactStats.set(nodeId, {
            eventCount: value.eventCount,
            topRiskType,
          });
        });

        setNodeRiskStats(compactStats);
      } catch (error) {
        console.error('Load node risk stats failed:', error);
      }
    };

    void loadNodeRiskStats();

    return () => {
      cancelled = true;
    };
  }, [chainNodes]);

  const nodeById = useMemo(() => {
    const map = new Map<number, ChainNode>();
    chainNodes.forEach((node) => {
      if (node.id !== undefined) {
        map.set(node.id, node);
      }
    });
    return map;
  }, [chainNodes]);

  const relationTypeOptions = useMemo(() => {
    const options = new Set<string>();
    relations.forEach((relation) => {
      if (relation.relationType) {
        options.add(relation.relationType);
      }
    });
    return Array.from(options).sort();
  }, [relations]);

  const filteredNodes = useMemo(() => {
    let result = chainNodes;

    // 如果选中事件，只显示该事件相关的节点
    if (selectedEvent) {
      const eventText = `${selectedEvent.title} ${selectedEvent.description}`.toLowerCase();
      const eventImpactStages = (selectedEvent.event_impacts || [])
        .map((imp) => imp.supply_chain_stage?.toLowerCase() || '')
        .filter(Boolean);
      const impactRegions = (selectedEvent.event_impacts || [])
        .filter((imp: any) => imp?.impact_type === 'region')
        .map((imp: any) => String(imp?.affected_area || '').toLowerCase())
        .filter(Boolean);
      const eventLocations = (selectedEvent.event_locations || [])
        .map((loc) => `${String(loc.location_name || '').toLowerCase()} ${String(loc.region || '').toLowerCase()}`.trim())
        .filter(Boolean);
      
      // 收集事件关联的所有产品tier3Code
      const eventProductCodes = new Set<string>();
      const eventProductNames = new Set<string>();
      if (selectedEvent.affected_products && Array.isArray(selectedEvent.affected_products)) {
        selectedEvent.affected_products.forEach((prod) => {
          if (prod.tier3Code) {
            eventProductCodes.add(prod.tier3Code.toLowerCase());
          }
          if (prod.tier3Name) {
            eventProductNames.add(prod.tier3Name.toLowerCase());
          }
        });
      }

      // 事件关键词用于无产品编码命中时的语义匹配，避免按阶段兜底引入无关节点
      const eventKeywords = new Set<string>([
        ...Array.from(eventProductNames),
      ]);
      const eventGeoKeywords = new Set<string>([
        ...impactRegions,
        ...eventLocations,
      ]);
      const mandatoryGeoKeywords = new Set<string>();
      if (selectedEvent.title?.includes('霍尔木兹')) {
        ['霍尔木兹', '海峡', '中东', '原油', '油气', 'lng'].forEach((k) => eventKeywords.add(k.toLowerCase()));
        ['霍尔木兹', '海峡', '中东', '波斯湾', '原油', '油气', 'lng'].forEach((k) => {
          const keyword = k.toLowerCase();
          eventGeoKeywords.add(keyword);
          mandatoryGeoKeywords.add(keyword);
        });
      }
      
      const strictMatchedNodes = chainNodes.filter((node) => {
        const nodeCode = node.code.toLowerCase();
        const nodeLabel = node.label.toLowerCase();
        const stage = inferStageName(node).toLowerCase();
        const nodeTier3Code = node.tier3Code?.toLowerCase() || '';
        const nodeTier3Name = node.tier3Name?.toLowerCase() || '';
        const nodeIncident = node.incident.toLowerCase();
        const nodeText = `${nodeLabel} ${nodeCode} ${nodeIncident} ${nodeTier3Name}`;
        const nodeGeoText = `${nodeLabel} ${nodeIncident}`;
        
        // 1. 检查节点代码或标签是否在事件描述中出现（精确匹配）
        const codeInEvent = eventText.includes(nodeCode);
        const labelInEvent = eventText.includes(nodeLabel);
        
        // 2. 检查节点是否通过产品关系与事件相关
        const productMatch = nodeTier3Code && eventProductCodes.has(nodeTier3Code);
        const productNameMatch = nodeTier3Name && eventProductNames.has(nodeTier3Name);
        const keywordMatch = Array.from(eventKeywords).some((kw) => kw.length >= 2 && (nodeText.includes(kw) || kw.includes(nodeLabel)));
        const effectiveGeoKeywords = mandatoryGeoKeywords.size > 0 ? mandatoryGeoKeywords : eventGeoKeywords;
        const hasGeoConstraint = effectiveGeoKeywords.size > 0;
        const geoMatch = !hasGeoConstraint || Array.from(effectiveGeoKeywords).some((kw) => {
          if (kw.length < 2) return false;
          return nodeGeoText.includes(kw) || nodeText.includes(kw);
        });
        
        // 3. 检查节点所在供应链阶段是否在事件影响中（仅当有明确的产品或代码匹配时才作为辅助条件）
        const stageInEvent = eventImpactStages.length > 0 && eventImpactStages.some((impStage) => stage.includes(impStage) || impStage.includes(stage));
        const stageWithOtherMatch = stageInEvent && (codeInEvent || labelInEvent || productMatch || productNameMatch || keywordMatch);
        
        // 仅当有明确的匹配时，才包含节点（不使用单纯的 stage 匹配作为通道）
        const baseMatch = codeInEvent || labelInEvent || productMatch || productNameMatch || keywordMatch || stageWithOtherMatch;
        const match = baseMatch && geoMatch;
        
        // 调试：选中霍尔木兹事件时查看每个节点的匹配情况
        if (selectedEvent?.title?.includes('霍尔木兹') && (node.code.includes('OIL') || node.code.includes('GAS'))) {
          console.log(`[Hormuz Event] Node ${node.code}:`, { 
            codeInEvent, 
            labelInEvent, 
            nodeTier3Code, 
            eventProductCodes: Array.from(eventProductCodes), 
            productMatch, 
            stageInEvent,
            match 
          });
        }
        
        // 调试：所有不匹配的节点
        if (selectedEvent?.title?.includes('霍尔木兹') && !match) {
          console.log(`[Hormuz Event] FILTERED OUT: ${node.code} -`, { 
            codeInEvent, 
            labelInEvent, 
            productMatch,
            stage 
          });
        }
        
        return match;
      });

      // 轻量视图匹配策略：仅展示事件定向命中的节点
      result = strictMatchedNodes;
    }

    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword) {
      result = result.filter((node) => 
        node.label.toLowerCase().includes(keyword)
        || node.code.toLowerCase().includes(keyword)
        || node.incident.toLowerCase().includes(keyword)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((node) => node.status === statusFilter);
    }

    return result;
  }, [chainNodes, selectedEvent, searchKeyword, statusFilter]);

  const visibleNodeIdSet = useMemo(() => new Set(filteredNodes.map((node) => Number(node.id))), [filteredNodes]);

  const filteredRelations = useMemo(() => {
    return relations.filter((relation) => {
      const inView = visibleNodeIdSet.has(relation.upstreamNodeId) && visibleNodeIdSet.has(relation.downstreamNodeId);
      if (!inView) {
        return false;
      }

      if (relationTypeFilter !== 'all' && relation.relationType !== relationTypeFilter) {
        return false;
      }

      if (!onlyRiskLinks) {
        return true;
      }

      const up = nodeById.get(relation.upstreamNodeId);
      const down = nodeById.get(relation.downstreamNodeId);
      return (up?.status !== 'normal') || (down?.status !== 'normal');
    });
  }, [relations, visibleNodeIdSet, relationTypeFilter, onlyRiskLinks, nodeById]);

  useEffect(() => {
    if (filteredNodes.length === 0) {
      return;
    }
    const exists = filteredNodes.some((node) => node.code === selectedNode.code);
    if (!exists) {
      setSelectedNode(filteredNodes[0]);
    }
  }, [filteredNodes, selectedNode]);

  const levelMap = useMemo(() => {
    const map = new Map<number, number>();
    const inDegree = new Map<number, number>();
    const graph = new Map<number, number[]>();

    filteredNodes.forEach((node) => {
      const id = Number(node.id);
      inDegree.set(id, 0);
      graph.set(id, []);
    });

    filteredRelations.forEach((rel) => {
      if (!graph.has(rel.upstreamNodeId) || !graph.has(rel.downstreamNodeId)) {
        return;
      }
      graph.get(rel.upstreamNodeId)!.push(rel.downstreamNodeId);
      inDegree.set(rel.downstreamNodeId, (inDegree.get(rel.downstreamNodeId) || 0) + 1);
    });

    const queue: number[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
        map.set(nodeId, 0);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = map.get(current) || 0;
      const neighbors = graph.get(current) || [];

      neighbors.forEach((next) => {
        const nextDegree = (inDegree.get(next) || 0) - 1;
        inDegree.set(next, nextDegree);
        map.set(next, Math.max(map.get(next) || 0, currentLevel + 1));
        if (nextDegree === 0) {
          queue.push(next);
        }
      });
    }

    filteredNodes.forEach((node) => {
      const id = Number(node.id);
      if (!map.has(id)) {
        map.set(id, 0);
      }
    });

    return map;
  }, [filteredNodes, filteredRelations]);

  const levelGroups = useMemo(() => {
    const grouped = new Map<number, ChainNode[]>();
    filteredNodes.forEach((node) => {
      const level = levelMap.get(Number(node.id)) || 0;
      if (!grouped.has(level)) {
        grouped.set(level, []);
      }
      grouped.get(level)!.push(node);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([level, nodes]) => ({ level, nodes }));
  }, [filteredNodes, levelMap]);

  const nodePositions = useMemo(() => {
    const positions = new Map<number, { x: number; y: number }>();
    const levelCount = Math.max(levelGroups.length, 1);

    levelGroups.forEach((group, levelIndex) => {
      // 横向分布（每层水平垂直分布，留出充分空间）
      const x = 10 + ((levelIndex) / Math.max(levelCount - 1, 1)) * 80;
      const count = Math.max(group.nodes.length, 1);

      // 纵向分布，尽量铺开，避免堆积
      const maxNodeHeight = Math.min(100 / count, 20); // 每个节点最多占据20%高度
      const totalHeight = Math.min(count * maxNodeHeight, 100);
      const startY = (100 - totalHeight) / 2; // 垂直居中

      group.nodes.forEach((node, idx) => {
        const y = startY + (idx * totalHeight) / Math.max(count - 1, 1);
        positions.set(Number(node.id), { 
          x: Math.max(5, Math.min(95, x)), 
          y: Math.max(5, Math.min(95, y)) 
        });
      });
    });

    return positions;
  }, [levelGroups]);

  const criticalCount = filteredNodes.filter((node) => node.status === 'critical').length;
  const normalCount = filteredNodes.filter((node) => node.status === 'normal').length;
  const warningCount = filteredNodes.filter((node) => node.status === 'warning').length;

  const avgDelayHours = useMemo(() => {
    const list = filteredNodes
      .map((node) => node.delayHours)
      .filter((value): value is number => typeof value === 'number');

    if (list.length === 0) {
      return 0;
    }

    return Math.round(list.reduce((sum, item) => sum + item, 0) / list.length);
  }, [filteredNodes]);

  const riskSpreadRate = useMemo(() => {
    if (filteredRelations.length === 0) {
      return 0;
    }

    const riskyRelationCount = filteredRelations.filter((relation) => {
      const upstream = nodeById.get(relation.upstreamNodeId);
      const downstream = nodeById.get(relation.downstreamNodeId);
      return upstream?.status !== 'normal' || downstream?.status !== 'normal';
    }).length;

    return Math.round((riskyRelationCount / filteredRelations.length) * 100);
  }, [filteredRelations, nodeById]);

  const topRiskNodes = useMemo(() => {
    return [...filteredNodes]
      .sort((a, b) => (b.riskLevel || 0) - (a.riskLevel || 0) || b.affectedOrders - a.affectedOrders)
      .slice(0, 5);
  }, [filteredNodes]);

  const hierarchyRows = useMemo(() => {
    return filteredNodes.map((node) => {
      const stat = typeof node.id === 'number' ? nodeRiskStats.get(node.id) : undefined;
      const stage = inferStageName(node);

      return {
        node,
        productLine: node.tier3Code ? `产品线-${node.tier3Code.slice(0, 2)}` : '通用产品线',
        category: node.tier3Name || '未分类品类',
        stage,
        regionEntity: inferRegionEntity(node),
        eventCount: stat?.eventCount || 0,
        topRiskType: stat?.topRiskType || '暂无',
      };
    });
  }, [filteredNodes, nodeRiskStats]);

  const riskTypeBoard = useMemo(() => {
    const board = new Map<string, number>();
    hierarchyRows.forEach((row) => {
      if (!row.topRiskType || row.topRiskType === '暂无') {
        return;
      }
      board.set(row.topRiskType, (board.get(row.topRiskType) || 0) + row.eventCount);
    });

    return Array.from(board.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [hierarchyRows]);

  const selectedUpstream = useMemo(() => {
    if (selectedNode.id === undefined) {
      return [] as ChainNode[];
    }

    return relations
      .filter((relation) => relation.downstreamNodeId === selectedNode.id)
      .map((relation) => nodeById.get(relation.upstreamNodeId))
      .filter((node): node is ChainNode => Boolean(node));
  }, [relations, selectedNode, nodeById]);

  const selectedDownstream = useMemo(() => {
    if (selectedNode.id === undefined) {
      return [] as ChainNode[];
    }

    return relations
      .filter((relation) => relation.upstreamNodeId === selectedNode.id)
      .map((relation) => nodeById.get(relation.downstreamNodeId))
      .filter((node): node is ChainNode => Boolean(node));
  }, [relations, selectedNode, nodeById]);

  const selectedRelationNotes = useMemo(() => {
    if (selectedNode.id === undefined) {
      return [] as ChainRelation[];
    }

    return relations.filter((relation) => relation.upstreamNodeId === selectedNode.id || relation.downstreamNodeId === selectedNode.id);
  }, [relations, selectedNode]);

  const materials = useMemo(() => {
    const source = filteredNodes.length > 0 ? filteredNodes : chainNodes;
    const mapped = source.slice(0, 8).map((node, index) => ({
      name: node.label,
      code: node.code,
      impact: node.status === 'critical' ? 'High' : node.status === 'warning' ? 'Medium' : 'Low',
      status: node.status === 'normal' ? 'Normal' : index % 2 === 0 ? 'Delay' : 'Watch',
    }));

    return mapped.length > 0 ? mapped : fallbackMaterials;
  }, [filteredNodes, chainNodes]);

  const summaryText = useMemo(
    () => `节点: ${selectedNode.label} (${selectedNode.code})\n状态: ${statusText[selectedNode.status]}\n延误: ${selectedNode.delay}\n受影响订单: ${selectedNode.affectedOrders}\n风险评分: ${selectedNode.riskLevel ?? '-'}\n上游节点数: ${selectedUpstream.length}\n下游节点数: ${selectedDownstream.length}\n事件: ${selectedNode.incident}`,
    [selectedNode, selectedUpstream.length, selectedDownstream.length]
  );

  const handleExportMaterialCsv = () => {
    downloadCsvFile(
      'supplychain-material-impact.csv',
      ['name', 'code', 'impact', 'status'],
      materials.map((item) => [item.name, item.code, item.impact, item.status])
    );
    notifyAction('已导出受影响物料 CSV');
  };

  const handleExportNodeBrief = () => {
    downloadTextFile(`node-${selectedNode.code}.txt`, summaryText);
    notifyAction(`已导出节点简报: ${selectedNode.code}`);
  };

  const handleExportTopologyCsv = () => {
    downloadCsvFile(
      'supplychain-topology-nodes.csv',
      ['id', 'label', 'code', 'status', 'riskLevel', 'delayHours', 'affectedOrders'],
      filteredNodes.map((node) => [
        node.id ?? '',
        node.label,
        node.code,
        statusText[node.status],
        node.riskLevel ?? '',
        node.delayHours ?? '',
        node.affectedOrders,
      ])
    );

    downloadCsvFile(
      'supplychain-topology-relations.csv',
      ['id', 'upstreamNodeId', 'downstreamNodeId', 'relationType', 'remark'],
      filteredRelations.map((relation) => [
        relation.id,
        relation.upstreamNodeId,
        relation.downstreamNodeId,
        relation.relationType ?? '',
        relation.remark ?? '',
      ])
    );

    notifyAction('已导出供应链节点与关系 CSV');
  };

  const gotoNodeEvents = (node: ChainNode) => {
    const stage = inferStageName(node);
    const params = new URLSearchParams({
      stage: stageToEventLibraryParam(stage),
      risk: statusToRiskParam(node.status),
      keyword: node.code,
    });

    window.location.hash = `#/events?${params.toString()}`;
  };

  const statusButtonClass = (key: StatusFilter) => cn(
    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
    statusFilter === key
      ? 'bg-[#adc6ff] text-[#0b1326] border-[#adc6ff]'
      : 'bg-[#131b2e] text-[#8b90a0] border-[#414755]/30 hover:border-[#adc6ff]/40 hover:text-[#dae2fd]'
  );

  return (
    <div className="p-8">
      {/* ===== 事件选择与风险提示区域 ===== */}
      <div className="mb-10 grid grid-cols-12 gap-6">
        {/* 事件列表 */}
        <div className="col-span-12 lg:col-span-3 bg-[#131b2e] border border-[#414755]/20 rounded-2xl p-6 max-h-[520px] overflow-y-auto">
          <h3 className="text-lg font-bold text-[#dae2fd] mb-4 flex items-center gap-2 sticky top-0 bg-[#131b2e] py-2">
            <TrendingUp className="w-5 h-5" />
            实时事件
          </h3>
          <div className="space-y-2">
            {eventList.length === 0 ? (
              <p className="text-xs text-[#8b90a0]">暂无事件</p>
            ) : (
              eventList.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={cn(
                    'w-full text-left p-2.5 rounded-lg border transition-all text-xs',
                    selectedEvent?.id === event.id
                      ? 'bg-[#364363] border-[#adc6ff] shadow-lg'
                      : 'bg-[#0b1326] border-[#414755]/20 hover:border-[#414755]/40'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={cn(
                      'w-3.5 h-3.5 flex-shrink-0 mt-0.5',
                      event.severity === 'critical' ? 'text-[#ff5545]' :
                      event.severity === 'warning' ? 'text-[#fe9400]' :
                      'text-[#adc6ff]'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#dae2fd] truncate text-[11px]">{event.title}</p>
                      <p className="text-[#8b90a0] line-clamp-1 text-[10px] leading-tight">{event.description}</p>
                      {event.confidenceScore && (
                        <p className="text-[9px] text-[#adc6ff] mt-0.5">置信: {Math.round(event.confidenceScore)}%</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 选中事件的详情与建议 */}
        {selectedEvent && (
          <div className="col-span-12 lg:col-span-9 bg-[#131b2e] border border-[#414755]/20 rounded-2xl p-5 max-h-[520px] overflow-y-auto">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-[#dae2fd] mb-1 line-clamp-2">{selectedEvent.title}</h2>
                <p className="text-xs text-[#8b90a0] line-clamp-2">{selectedEvent.description}</p>
              </div>
              <div className={cn(
                'px-3 py-1.5 rounded-lg font-bold text-[10px] whitespace-nowrap flex-shrink-0',
                selectedEvent.severity === 'critical' ? 'bg-[#ff5545]/20 text-[#ff5545]' :
                selectedEvent.severity === 'warning' ? 'bg-[#fe9400]/20 text-[#fe9400]' :
                'bg-[#adc6ff]/20 text-[#adc6ff]'
              )}>
                {selectedEvent.severity === 'critical' ? '严重' :
                 selectedEvent.severity === 'warning' ? '预警' :
                 '信息'}
              </div>
            </div>

            {/* 风险影响 - 简化版 */}
            {selectedEvent.event_impacts && selectedEvent.event_impacts.length > 0 && (
              <div className="mt-3 bg-[#0b1326] rounded-lg p-3 border border-[#414755]/20">
                <p className="text-[10px] font-bold text-[#adc6ff] mb-2 uppercase">风险影响</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedEvent.event_impacts.slice(0, 4).map((impact, idx) => (
                    <div key={idx} className="p-2 bg-[#131b2e] rounded text-[9px] border border-[#414755]/10">
                      <p className="text-[#adc6ff] font-bold truncate">{impact.estimated_impact}</p>
                      {impact.recovery_days && (
                        <p className="text-[#fe9400] mt-0.5">恢复: {impact.recovery_days}天</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 风险应对建议 - 简化版 */}
            {selectedEvent && (
              <div className="mt-3 bg-[#0b1326] rounded-lg p-3 border border-[#ff5545]/20">
                <p className="text-[10px] font-bold text-[#ff5545] mb-2 flex items-center gap-1 uppercase">
                  <AlertTriangle className="w-3 h-3" />
                  应对建议
                </p>
                <ul className="space-y-1 text-[9px] text-[#dae2fd]">
                  <li className="flex gap-1.5">
                    <span className="text-[#adc6ff] font-bold flex-shrink-0">•</span>
                    <span>筛查受影响的供应链节点</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-[#adc6ff] font-bold flex-shrink-0">•</span>
                    <span>启动上下游应急联动</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-[#adc6ff] font-bold flex-shrink-0">•</span>
                    <span>提前启动备选方案</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== 原有的供应链拓扑视图 ===== */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-2">
            {selectedEvent ? `${selectedEvent.title} 供应链影响分析` : '选择事件查看供应链影响'}
          </h2>
          <p className="text-[#c1c6d7] font-medium">
            {selectedEvent 
              ? `展示该事件影响的 ${filteredNodes.length} 个供应链节点及其上下游关系` 
              : '在左侧选择实时事件，此处将显示受影响的供应链节点和传播链路'}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-[#131b2e] px-4 py-2 rounded-lg border border-[#414755]/20">
            <div className="w-3 h-3 rounded-full bg-[#ff5545] shadow-[0_0_8px_#ff5545]"></div>
            <span className="text-xs font-bold">高风险节点 ({criticalCount})</span>
          </div>
          <div className="flex items-center gap-2 bg-[#131b2e] px-4 py-2 rounded-lg border border-[#414755]/20">
            <div className="w-3 h-3 rounded-full bg-[#fe9400] shadow-[0_0_8px_#fe9400]"></div>
            <span className="text-xs font-bold">预警节点 ({warningCount})</span>
          </div>
          <div className="flex items-center gap-2 bg-[#131b2e] px-4 py-2 rounded-lg border border-[#414755]/20">
            <div className="w-3 h-3 rounded-full bg-[#adc6ff] shadow-[0_0_8px_#adc6ff]"></div>
            <span className="text-xs font-bold">运行正常 ({normalCount})</span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4 bg-[#131b2e] border border-[#414755]/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#8b90a0]" />
          <input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="搜索节点名称、编码或事件"
            className="w-full bg-transparent outline-none text-sm text-[#dae2fd] placeholder:text-[#5f6678]"
          />
        </div>
        <div className="col-span-12 lg:col-span-4 bg-[#131b2e] border border-[#414755]/20 rounded-xl px-4 py-3 flex items-center gap-2">
          <button className={statusButtonClass('all')} onClick={() => setStatusFilter('all')}>全部</button>
          <button className={statusButtonClass('critical')} onClick={() => setStatusFilter('critical')}>中断</button>
          <button className={statusButtonClass('warning')} onClick={() => setStatusFilter('warning')}>预警</button>
          <button className={statusButtonClass('normal')} onClick={() => setStatusFilter('normal')}>正常</button>
        </div>
        <div className="col-span-12 lg:col-span-4 bg-[#131b2e] border border-[#414755]/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <GitBranch className="w-4 h-4 text-[#8b90a0]" />
          <select
            value={relationTypeFilter}
            onChange={(event) => setRelationTypeFilter(event.target.value)}
            className="bg-transparent outline-none text-sm text-[#dae2fd]"
          >
            <option value="all">全部关系类型</option>
            {relationTypeOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <label className="ml-auto flex items-center gap-2 text-xs font-bold text-[#8b90a0]">
            <input
              type="checkbox"
              checked={onlyRiskLinks}
              onChange={(event) => setOnlyRiskLinks(event.target.checked)}
            />
            只看风险链路
          </label>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-9 bg-[#131b2e] border border-[#414755]/20 rounded-2xl p-6">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-[#dae2fd]">产业链轻量视图</h3>
              <p className="text-xs text-[#8b90a0] mt-1">产品线 → 品类 → 环节 → 地区/实体，含节点事件数与 Top 风险类型</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-[#8b90a0] border-b border-[#414755]/20">
                  <th className="py-3 pr-3">产品线</th>
                  <th className="py-3 pr-3">品类</th>
                  <th className="py-3 pr-3">环节</th>
                  <th className="py-3 pr-3">地区/实体</th>
                  <th className="py-3 pr-3">节点</th>
                  <th className="py-3 pr-3">事件数</th>
                  <th className="py-3 pr-3">Top风险类型</th>
                  <th className="py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {hierarchyRows.map((row) => (
                  <tr key={`hier-${row.node.code}`} className="border-b border-[#414755]/10 text-xs text-[#dae2fd]">
                    <td className="py-3 pr-3">{row.productLine}</td>
                    <td className="py-3 pr-3">{row.category}</td>
                    <td className="py-3 pr-3">{row.stage}</td>
                    <td className="py-3 pr-3">{row.regionEntity}</td>
                    <td className="py-3 pr-3 font-semibold">{row.node.label}</td>
                    <td className="py-3 pr-3">{row.eventCount}</td>
                    <td className="py-3 pr-3 text-[#adc6ff]">{row.topRiskType}</td>
                    <td className="py-3">
                      <button
                        onClick={() => gotoNodeEvents(row.node)}
                        className="px-3 py-1.5 rounded-lg bg-[#2c3651] hover:bg-[#364363] text-[#dae2fd] font-bold"
                      >
                        查看事件
                      </button>
                    </td>
                  </tr>
                ))}
                {hierarchyRows.length === 0 && (
                  <tr>
                    <td className="py-4 text-[#8b90a0]" colSpan={8}>当前筛选无节点数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-3 bg-[#131b2e] border border-[#414755]/20 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#dae2fd] mb-4">风险类型热度 Top 5</h3>
          <div className="space-y-3">
            {riskTypeBoard.map(([name, count], idx) => (
              <div key={`risk-board-${name}`} className="flex items-center justify-between text-xs">
                <span className="text-[#dae2fd]">{idx + 1}. {name}</span>
                <span className="text-[#8b90a0]">{count}</span>
              </div>
            ))}
            {riskTypeBoard.length === 0 && <p className="text-xs text-[#8b90a0]">暂无可展示风险类型</p>}
          </div>
        </div>
      </div>

      {/* Topology Visualization Section */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Topology Visualization */}
        <div className="col-span-12 lg:col-span-9 relative bg-[#060e20] rounded-2xl border border-[#414755]/10 p-12 min-h-[800px] overflow-hidden">
          {/* Background Grid */}
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#adc6ff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

          {/* Empty State Message */}
          {filteredNodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
              <div className="text-center bg-[#131b2e]/80 backdrop-blur-md p-8 rounded-xl border border-[#414755]/30">
                <AlertTriangle className="w-12 h-12 text-[#fe9400] mx-auto mb-4" />
                <p className="text-lg font-bold text-[#dae2fd] mb-2">
                  {selectedEvent ? '没有相关供应链节点' : '请选择事件查看供应链影响'}
                </p>
                <p className="text-sm text-[#8b90a0] max-w-sm">
                  {selectedEvent 
                    ? `事件"${selectedEvent.title}"暂未关联到具体的供应链节点`
                    : '在左侧事件列表中选择一个事件，此处将显示该事件影响的供应链节点'}
                </p>
              </div>
            </div>
          )}

          {/* Connection Lines (Simulated) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {filteredRelations.map((relation) => {
              const upstream = nodePositions.get(relation.upstreamNodeId);
              const downstream = nodePositions.get(relation.downstreamNodeId);
              const upstreamNode = nodeById.get(relation.upstreamNodeId);
              const downstreamNode = nodeById.get(relation.downstreamNodeId);

              if (!upstream || !downstream || !upstreamNode || !downstreamNode) {
                return null;
              }

              const linkSeverity = upstreamNode.status === 'critical' || downstreamNode.status === 'critical'
                ? 'critical'
                : upstreamNode.status === 'warning' || downstreamNode.status === 'warning'
                ? 'warning'
                : 'normal';

              const stroke = linkSeverity === 'critical' ? '#ff5545' : linkSeverity === 'warning' ? '#fe9400' : '#adc6ff';
              const strokeWidth = linkSeverity === 'critical' ? 2 : 1.2;
              const dash = linkSeverity === 'critical' ? '6,4' : undefined;

              return (
                <line
                  key={relation.id}
                  x1={`${upstream.x}%`}
                  y1={`${upstream.y}%`}
                  x2={`${downstream.x}%`}
                  y2={`${downstream.y}%`}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dash}
                  opacity={0.9}
                />
              );
            })}
          </svg>

          <div className="relative z-10 h-full">
            {filteredNodes.map((node, index) => {
              const position = nodePositions.get(Number(node.id)) || { x: 50, y: Math.max(5, Math.min(95, 20 + index * 12)) };
              return (
                <div
                  key={node.code}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                >
                  <Node
                    icon={node.status === 'critical' ? Truck : node.status === 'warning' ? Factory : Database}
                    label={node.label}
                    status={node.status}
                    onClick={() => setSelectedNode(node)}
                  />
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="absolute bottom-6 left-6 bg-[#131b2e]/80 backdrop-blur-md p-4 rounded-xl border border-[#414755]/20 z-10">
            <h4 className="text-[10px] font-bold text-[#8b90a0] uppercase tracking-widest mb-3">节点状态说明</h4>
            <div className="space-y-2">
              <LegendItem color="#ff5545" label="中断 / 严重风险" />
              <LegendItem color="#fe9400" label="预警 / 潜在延误" />
              <LegendItem color="#adc6ff" label="正常运行" />
            </div>
          </div>
        </div>

        {/* Right: Node Detail Overlay */}
        <div className="col-span-12 lg:col-span-3 bg-[#131b2e]/95 backdrop-blur-xl p-6 rounded-xl border border-[#ff5545]/30 shadow-2xl max-h-[800px] overflow-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#ff5545]/20 flex items-center justify-center flex-shrink-0">
              <Truck className="w-6 h-6 text-[#ff5545]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[#dae2fd] text-sm line-clamp-1">{selectedNode.label} ({selectedNode.code})</h3>
              <span className={cn(
                'text-[10px] font-bold uppercase',
                selectedNode.status === 'critical' ? 'text-[#ff5545]' : selectedNode.status === 'warning' ? 'text-[#fe9400]' : 'text-[#adc6ff]'
              )}>
                {selectedNode.status === 'critical' ? '严重风险' : selectedNode.status === 'warning' ? '预警中' : '运行稳定'}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-3 bg-[#0b1326] rounded-lg border border-[#414755]/20">
              <p className="text-[10px] text-[#8b90a0] uppercase font-bold mb-1">当前事件</p>
              <p className="text-xs text-[#dae2fd] font-medium line-clamp-2">{selectedNode.incident}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#0b1326] rounded-lg border border-[#414755]/20">
                <p className="text-[10px] text-[#8b90a0] uppercase font-bold mb-1">预计延误</p>
                <p className="text-sm font-bold text-[#ff5545]">{selectedNode.delay}</p>
              </div>
              <div className="p-3 bg-[#0b1326] rounded-lg border border-[#414755]/20">
                <p className="text-[10px] text-[#8b90a0] uppercase font-bold mb-1">影响订单</p>
                <p className="text-sm font-bold text-[#dae2fd]">{selectedNode.affectedOrders}</p>
              </div>
            </div>
            <div className="p-3 bg-[#0b1326] rounded-lg border border-[#414755]/20">
              <p className="text-[10px] text-[#8b90a0] uppercase font-bold mb-1">风险评分</p>
              <p className="text-sm font-bold text-[#dae2fd]">{selectedNode.riskLevel ?? '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#0b1326] rounded-lg border border-[#414755]/20">
                <p className="text-[10px] text-[#8b90a0] uppercase font-bold mb-1">上游节点</p>
                <p className="text-sm font-bold text-[#dae2fd]">{selectedUpstream.length}</p>
              </div>
              <div className="p-3 bg-[#0b1326] rounded-lg border border-[#414755]/20">
                <p className="text-[10px] text-[#8b90a0] uppercase font-bold mb-1">下游节点</p>
                <p className="text-sm font-bold text-[#dae2fd]">{selectedDownstream.length}</p>
              </div>
            </div>
            <div className="p-3 bg-[#0b1326] rounded-lg border border-[#414755]/20">
              <p className="text-[10px] text-[#8b90a0] uppercase font-bold mb-2">关联节点</p>
              <div className="space-y-2 text-xs max-h-[120px] overflow-y-auto">
                {selectedUpstream.slice(0, 3).map((node) => (
                  <button
                    key={`up-${node.code}`}
                    onClick={() => setSelectedNode(node)}
                    className="w-full text-left text-[#adc6ff] hover:text-[#dae2fd] truncate text-[10px]"
                  >
                    上游: {node.label}
                  </button>
                ))}
                {selectedDownstream.slice(0, 3).map((node) => (
                  <button
                    key={`down-${node.code}`}
                    onClick={() => setSelectedNode(node)}
                    className="w-full text-left text-[#adc6ff] hover:text-[#dae2fd] truncate text-[10px]"
                  >
                    下游: {node.label}
                  </button>
                ))}
                {selectedUpstream.length + selectedDownstream.length === 0 && (
                  <p className="text-[#8b90a0] text-[10px]">暂无上下游关系</p>
                )}
              </div>
            </div>
            <div className="p-3 bg-[#0b1326] rounded-lg border border-[#414755]/20">
              <p className="text-[10px] text-[#8b90a0] uppercase font-bold mb-2">关系备注</p>
              <div className="space-y-2 text-xs text-[#dae2fd] max-h-[100px] overflow-y-auto">
                {selectedRelationNotes.slice(0, 4).map((relation) => (
                  <div key={`note-${relation.id}`} className="border-l border-[#414755]/40 pl-2 text-[9px]">
                    <p className="text-[#adc6ff] font-bold truncate">{relation.relationType || '关系'}</p>
                    <p className="text-[#8b90a0] line-clamp-2">{relation.remark || '无备注'}</p>
                  </div>
                ))}
                {selectedRelationNotes.length === 0 && <p className="text-[#8b90a0] text-[10px]">暂无关系备注</p>}
              </div>
            </div>
            <button
              onClick={handleExportNodeBrief}
              className="w-full py-2 bg-[#ff5545] text-white font-bold text-xs rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              导出节点分析 <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportTopologyCsv}
              className="w-full py-2 bg-[#2c3651] text-[#dae2fd] font-bold text-xs rounded-lg hover:bg-[#364363] transition-all flex items-center justify-center gap-2"
            >
              导出当前拓扑数据 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Impact Analysis Table */}
      <div className="mt-12 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-[#131b2e] p-8 rounded-xl border border-[#414755]/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl">受影响节点清单</h3>
            <button
              onClick={handleExportMaterialCsv}
              className="text-xs font-bold text-[#adc6ff] flex items-center gap-1"
            >
              导出 CSV <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {materials.map((item) => (
              <MaterialItem key={item.code} name={item.name} code={item.code} impact={item.impact} status={item.status} />
            ))}
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 bg-[#131b2e] p-8 rounded-xl border border-[#414755]/10">
          <h3 className="font-bold text-xl mb-6">风险传播热度</h3>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-[#ff5545] flex items-center justify-center text-xs font-black text-[#ff5545]">
                {riskSpreadRate}%
              </div>
              <div>
                <p className="text-sm font-bold">风险链路占比</p>
                <p className="text-xs text-[#8b90a0]">当前筛选下风险关系在全链路中的占比</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-[#fe9400] flex items-center justify-center text-xs font-black text-[#fe9400]">
                {avgDelayHours}h
              </div>
              <div>
                <p className="text-sm font-bold">平均延误时长</p>
                <p className="text-xs text-[#8b90a0]">根据当前展示节点计算</p>
              </div>
            </div>
            <div className="p-4 bg-[#0b1326] rounded-lg border border-[#414755]/20">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="w-4 h-4 text-[#adc6ff]" />
                <p className="text-xs font-bold text-[#adc6ff]">风险节点排行</p>
              </div>
              <div className="space-y-2">
                {topRiskNodes.map((node, index) => (
                  <button
                    key={node.code}
                    onClick={() => setSelectedNode(node)}
                    className="w-full text-left flex items-center justify-between text-xs"
                  >
                    <span className="text-[#dae2fd]">{index + 1}. {node.label}</span>
                    <span className="text-[#8b90a0]">{node.riskLevel ?? 0}</span>
                  </button>
                ))}
                {topRiskNodes.length === 0 && <p className="text-xs text-[#8b90a0]">暂无可展示节点</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Node = ({ icon: Icon, label, status, onClick }: any) => (
  <div className="group relative flex flex-col items-center gap-3">
    <button onClick={onClick} className={cn(
      "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 cursor-pointer border-2",
      status === 'critical' ? "bg-[#ff5545]/10 border-[#ff5545] shadow-[0_0_20px_rgba(255,85,69,0.2)]" :
      status === 'warning' ? "bg-[#fe9400]/10 border-[#fe9400] shadow-[0_0_20px_rgba(254,148,0,0.2)]" :
      "bg-[#adc6ff]/5 border-[#adc6ff]/30 hover:border-[#adc6ff] shadow-lg"
    )}>
      <Icon className={cn(
        "w-8 h-8",
        status === 'critical' ? "text-[#ff5545]" :
        status === 'warning' ? "text-[#fe9400]" :
        "text-[#adc6ff]"
      )} />
    </button>
    <div className="text-center">
      <p className="text-xs font-bold text-[#dae2fd]">{label}</p>
      <p className={cn(
        "text-[10px] font-black uppercase tracking-tighter",
        status === 'critical' ? "text-[#ff5545]" :
        status === 'warning' ? "text-[#fe9400]" :
        "text-[#8b90a0]"
      )}>
        {status === 'critical' ? '中断' : status === 'warning' ? '预警' : '正常'}
      </p>
    </div>
  </div>
);

const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center gap-2">
    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
    <span className="text-[10px] font-bold text-[#dae2fd]">{label}</span>
  </div>
);

const MaterialItem = ({ name, code, impact, status }: any) => (
  <div className="flex items-center justify-between p-4 bg-[#171f33] rounded-lg border border-[#414755]/10 hover:border-[#adc6ff]/30 transition-all">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded bg-[#2d3449] flex items-center justify-center">
        <Activity className="w-5 h-5 text-[#adc6ff]" />
      </div>
      <div>
        <p className="text-sm font-bold text-[#dae2fd]">{name}</p>
        <p className="text-[10px] text-[#8b90a0] font-mono">{code}</p>
      </div>
    </div>
    <div className="flex items-center gap-8">
      <div className="text-right">
        <p className="text-[10px] text-[#8b90a0] uppercase font-bold">影响等级</p>
        <p className={cn(
          "text-xs font-black",
          impact === 'High' ? "text-[#ff5545]" : impact === 'Medium' ? "text-[#fe9400]" : "text-[#adc6ff]"
        )}>{impact}</p>
      </div>
      <div className="text-right min-w-[80px]">
        <p className="text-[10px] text-[#8b90a0] uppercase font-bold">状态</p>
        <p className="text-xs font-bold text-[#dae2fd]">{status}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-[#414755]" />
    </div>
  </div>
);
