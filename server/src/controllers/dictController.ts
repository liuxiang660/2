import { Request, Response } from 'express';
import { supabase } from '../utils/db';

type TopologyStatus = 'normal' | 'warning' | 'critical';

const normalizeStatusByRiskLevel = (riskLevel?: unknown): TopologyStatus | null => {
  if (riskLevel === null || riskLevel === undefined) {
    return null;
  }

  const level = Number(riskLevel);
  if (Number.isNaN(level)) {
    return null;
  }

  if (level >= 80) {
    return 'critical';
  }

  if (level >= 50) {
    return 'warning';
  }

  return 'normal';
};

const inferNodeStatus = (remark?: string | null): TopologyStatus => {
  const text = String(remark || '').toLowerCase();

  if (/(中断|罢工|停产|critical|severe|urgent)/.test(text)) {
    return 'critical';
  }

  if (/(延误|拥堵|检修|warning|risk)/.test(text)) {
    return 'warning';
  }

  return 'normal';
};

// 获取所有字典表数据
export const getAllDictionaries = async (req: Request, res: Response) => {
  try {
    const [
      productTier1,
      productTier2,
      productTier3,
      riskTier1,
      riskTier2,
      naturalDisaster1,
      naturalDisaster2,
      supplychain1,
      supplychain2,
      mediaSource,
      transportType,
      country,
      unRegion,
    ] = await Promise.all([
      supabase.from('product_tier1_code_dict').select('*'),
      supabase.from('product_tier2_code_dict').select('*'),
      supabase.from('product_tier3_code_dict').select('*'),
      supabase.from('risk_tier1_type_dict').select('*'),
      supabase.from('risk_tier2_type_dict').select('*'),
      supabase.from('natural_disaster_tier1_dict').select('*'),
      supabase.from('natural_disaster_tier2_dict').select('*'),
      supabase.from('supplychain_tier1_dict').select('*'),
      supabase.from('supplychain_tier2_dict').select('*'),
      supabase.from('media_data_source_dict').select('*'),
      supabase.from('transport_type_dict').select('*'),
      supabase.from('country_code_dict').select('*'),
      supabase.from('un_region_dict').select('*'),
    ]);

    const dictionaries = {
      productTier1: productTier1.data || [],
      productTier2: productTier2.data || [],
      productTier3: productTier3.data || [],
      riskTier1: riskTier1.data || [],
      riskTier2: riskTier2.data || [],
      naturalDisaster1: naturalDisaster1.data || [],
      naturalDisaster2: naturalDisaster2.data || [],
      supplychain1: supplychain1.data || [],
      supplychain2: supplychain2.data || [],
      mediaSource: mediaSource.data || [],
      transportType: transportType.data || [],
      country: country.data || [],
      unRegion: unRegion.data || [],
    };

    res.json(dictionaries);
  } catch (error) {
    console.error('Error fetching dictionaries:', error);
    res.status(500).json({ error: 'Failed to fetch dictionaries' });
  }
};

// 获取产品分类树
export const getProductClassification = async (req: Request, res: Response) => {
  try {
    const { data: tier1 } = await supabase
      .from('product_tier1_code_dict')
      .select('*');

    const result = await Promise.all(
      (tier1 || []).map(async (t1) => {
        const { data: tier2 } = await supabase
          .from('product_tier2_code_dict')
          .select('*')
          .eq('tier1_id', t1.id);

        const tier2WithChildren = await Promise.all(
          (tier2 || []).map(async (t2) => {
            const { data: tier3 } = await supabase
              .from('product_tier3_code_dict')
              .select('*')
              .eq('tier2_id', t2.id);

            return {
              ...t2,
              children: tier3 || [],
            };
          })
        );

        return {
          ...t1,
          children: tier2WithChildren,
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching product classification:', error);
    res.status(500).json({ error: 'Failed to fetch product classification' });
  }
};

// 获取风险分类树
export const getRiskClassification = async (req: Request, res: Response) => {
  try {
    const { data: tier1 } = await supabase
      .from('risk_tier1_type_dict')
      .select('*');

    const result = await Promise.all(
      (tier1 || []).map(async (t1) => {
        const { data: tier2 } = await supabase
          .from('risk_tier2_type_dict')
          .select('*')
          .eq('risk_tier1_type_id', t1.id);

        return {
          ...t1,
          children: tier2 || [],
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching risk classification:', error);
    res.status(500).json({ error: 'Failed to fetch risk classification' });
  }
};

// 获取供应链流程
export const getSupplychainProcess = async (req: Request, res: Response) => {
  try {
    const { data: tier1 } = await supabase
      .from('supplychain_tier1_dict')
      .select('*')
      .order('sequence_no', { ascending: true });

    const result = await Promise.all(
      (tier1 || []).map(async (t1) => {
        const { data: tier2 } = await supabase
          .from('supplychain_tier2_dict')
          .select('*')
          .eq('tier1_id', t1.id)
          .order('sequence_no', { ascending: true });

        return {
          ...t1,
          children: tier2 || [],
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching supplychain process:', error);
    res.status(500).json({ error: 'Failed to fetch supplychain process' });
  }
};

// 获取媒体数据源
export const getMediaSources = async (req: Request, res: Response) => {
  try {
    const { data } = await supabase
      .from('media_data_source_dict')
      .select('*');

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching media sources:', error);
    res.status(500).json({ error: 'Failed to fetch media sources' });
  }
};

// 获取地理信息
export const getGeographicData = async (req: Request, res: Response) => {
  try {
    const [
      { data: regions },
      { data: subregions },
      { data: countries },
    ] = await Promise.all([
      supabase.from('un_region_dict').select('*'),
      supabase.from('un_subregion_dict').select('*'),
      supabase.from('country_code_dict').select('*'),
    ]);

    res.json({
      regions: regions || [],
      subregions: subregions || [],
      countries: countries || [],
    });
  } catch (error) {
    console.error('Error fetching geographic data:', error);
    res.status(500).json({ error: 'Failed to fetch geographic data' });
  }
};

// 获取自然灾害分类
export const getDisasterClassification = async (req: Request, res: Response) => {
  try {
    const { data: tier1 } = await supabase
      .from('natural_disaster_tier1_dict')
      .select('*');

    const result = await Promise.all(
      (tier1 || []).map(async (t1) => {
        const { data: tier2 } = await supabase
          .from('natural_disaster_tier2_dict')
          .select('*')
          .eq('tier1_id', t1.id);

        return {
          ...t1,
          children: tier2 || [],
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching disaster classification:', error);
    res.status(500).json({ error: 'Failed to fetch disaster classification' });
  }
};

// 获取供应链拓扑（节点+上下游关系）
export const getSupplychainTopology = async (req: Request, res: Response) => {
  try {
    const [{ data: nodes }, { data: relations }, { data: tier3 }] = await Promise.all([
      supabase
        .from('industry_chain_node_dict')
        .select('*')
        .order('id', { ascending: true }),
      supabase
        .from('industry_chain_node_relation')
        .select('id, upstream_node_id, downstream_node_id, relation_type, remark'),
      supabase
        .from('product_tier3_code_dict')
        .select('id, tier3_code, tier3_name'),
    ]);

    const tier3Map = new Map<number, { tier3_code: string; tier3_name: string }>();
    (tier3 || []).forEach((item: any) => {
      tier3Map.set(Number(item.id), {
        tier3_code: item.tier3_code,
        tier3_name: item.tier3_name,
      });
    });

    const upstreamCountMap = new Map<number, number>();
    const downstreamCountMap = new Map<number, number>();

    (relations || []).forEach((relation: any) => {
      const up = Number(relation.upstream_node_id);
      const down = Number(relation.downstream_node_id);
      downstreamCountMap.set(up, (downstreamCountMap.get(up) || 0) + 1);
      upstreamCountMap.set(down, (upstreamCountMap.get(down) || 0) + 1);
    });

    const formattedNodes = (nodes || []).map((node: any) => {
      const tier3Info = tier3Map.get(Number(node.tier3_id));
      const status = normalizeStatusByRiskLevel(node.risk_level) || inferNodeStatus(node.remark);

      return {
        id: Number(node.id),
        nodeCode: node.node_code,
        nodeName: node.node_name,
        tier3Id: Number(node.tier3_id),
        tier3Code: tier3Info?.tier3_code || null,
        tier3Name: tier3Info?.tier3_name || null,
        riskLevel: node.risk_level ?? null,
        delayHours: node.delay_hours ?? null,
        status,
        remark: node.remark || '',
        upstreamCount: upstreamCountMap.get(Number(node.id)) || 0,
        downstreamCount: downstreamCountMap.get(Number(node.id)) || 0,
      };
    });

    const formattedRelations = (relations || []).map((relation: any) => ({
      id: Number(relation.id),
      upstreamNodeId: Number(relation.upstream_node_id),
      downstreamNodeId: Number(relation.downstream_node_id),
      relationType: relation.relation_type || null,
      remark: relation.remark || '',
    }));

    const summary = {
      totalNodes: formattedNodes.length,
      totalRelations: formattedRelations.length,
      criticalNodes: formattedNodes.filter((n: any) => n.status === 'critical').length,
      warningNodes: formattedNodes.filter((n: any) => n.status === 'warning').length,
      normalNodes: formattedNodes.filter((n: any) => n.status === 'normal').length,
    };

    res.json({
      success: true,
      data: {
        nodes: formattedNodes,
        relations: formattedRelations,
        summary,
      },
    });
  } catch (error) {
    console.error('Error fetching supplychain topology:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch supplychain topology' });
  }
};
