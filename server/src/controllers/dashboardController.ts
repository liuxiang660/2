import { Response } from 'express';
import { supabase } from '../utils/db';
import { AuthRequest } from '../middleware';

async function resolveUserAccountId(req: AuthRequest): Promise<number> {
  const rawId = Number(req.user?.id || req.user?.userId);
  if (Number.isFinite(rawId) && rawId > 0) {
    return rawId;
  }

  const username = String((req.user as any)?.username || '').trim();
  if (username) {
    const { data } = await supabase
      .from('user_account')
      .select('id')
      .eq('username', username)
      .limit(1)
      .maybeSingle();
    if (data?.id) return Number(data.id);
  }

  const email = String(req.user?.email || '').trim();
  if (email) {
    const { data } = await supabase
      .from('user_account')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (data?.id) return Number(data.id);
  }

  const fallbackUsername = username || `demo_${Date.now()}`;
  const fallbackEmail = email || null;
  const defaultConfig = {
    focusIndustries: ['消费电子'],
    riskSensitivity: 'medium',
    watchRegions: ['亚太'],
    minConfidence: 70,
    notifyByEmail: true,
    trackSupplyStages: ['生产制造', '港口码头'],
  };

  const { data: created, error: createError } = await supabase
    .from('user_account')
    .insert({
      username: fallbackUsername,
      password_hash: 'demo-password-hash',
      email: fallbackEmail,
      full_name: fallbackUsername,
      is_active: 1,
      login_count: 0,
      product_portrait_config: defaultConfig,
      product_portrait_rows: [],
      product_portrait_updated_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (!createError && created?.id) {
    return Number(created.id);
  }

  if (username) {
    const { data: byUsername } = await supabase
      .from('user_account')
      .select('id')
      .eq('username', username)
      .limit(1)
      .maybeSingle();
    if (byUsername?.id) return Number(byUsername.id);
  }

  if (email) {
    const { data: byEmail } = await supabase
      .from('user_account')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (byEmail?.id) return Number(byEmail.id);
  }

  throw new Error(createError?.message || '无法解析当前用户账户');
}

function buildRecommendationFilter(userAccountId: number): string {
  return `alert_type.neq.recommendation,and(alert_type.eq.recommendation,title.ilike.[U${userAccountId}]%)`;
}

export interface DashboardData {
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
    latest_high_risk_events: any[];
  };
  alerts: any[];
  trends: any[];
  risk_distribution: any[];
  global_risk_index: number | null;
  critical_regions: string[];
  critical_region_stats: Array<{ name: string; count: number }>;
  recent_events: any[];
}

export const dashboardController = {
  // Get dashboard data
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const organization_id = req.organization_id;
      const timeRange = (req.query.time_range as string) || '7days';
      const userAccountId = await resolveUserAccountId(req);
      const userId = String(userAccountId);

      if (!organization_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing organization_id',
        });
      }

      // Calculate date range
      const now = new Date();
      let daysBack = 7;
      if (timeRange === '30days') daysBack = 30;
      if (timeRange === '90days') daysBack = 90;

      const dateFrom = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      const dateFromIso = dateFrom.toISOString();

      const normalizeSeverity = (value: unknown): 'critical' | 'warning' | 'info' => {
        const raw = String(value || '').toLowerCase().trim();

        if (['critical', 'high', 'severe', 'urgent', '严重', '高风险', '紧急'].includes(raw)) {
          return 'critical';
        }

        if (['warning', 'warn', 'medium', 'moderate', '预警', '中风险'].includes(raw)) {
          return 'warning';
        }

        return 'info';
      };

      const applyEventTimeWindow = (query: any, startIso: string) => {
        return query.or(`occurred_at.gte.${startIso},and(occurred_at.is.null,created_at.gte.${startIso})`);
      };

      // Get total events
      const { count: totalEvents7d } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .or(`occurred_at.gte.${dateFromIso},and(occurred_at.is.null,created_at.gte.${dateFromIso})`)
        .is('deleted_at', null);

      // Get events from last 30 days
      const dateFrom30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const dateFrom30dIso = dateFrom30d.toISOString();
      const { count: totalEvents30d } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .or(`occurred_at.gte.${dateFrom30dIso},and(occurred_at.is.null,created_at.gte.${dateFrom30dIso})`)
        .is('deleted_at', null);

      // Get recent events severities for high-risk statistics
      const { data: recentSeverityRows } = await applyEventTimeWindow(
        supabase
          .from('events')
          .select('id, severity, created_at, occurred_at, title, description')
          .eq('organization_id', organization_id)
          .is('deleted_at', null),
        dateFromIso
      );

      const severitySummary = (recentSeverityRows || []).reduce(
        (acc: { critical: number; warning: number; info: number }, row: any) => {
          const normalized = normalizeSeverity(row.severity);
          acc[normalized] += 1;
          return acc;
        },
        { critical: 0, warning: 0, info: 0 }
      );

      const highRiskEvents = severitySummary.critical + severitySummary.warning;

      const latestHighRiskEvents = (recentSeverityRows || [])
        .filter((row: any) => {
          const normalized = normalizeSeverity(row.severity);
          return normalized === 'critical' || normalized === 'warning';
        })
        .sort((a: any, b: any) => {
          const ta = new Date(a.occurred_at || a.created_at || 0).getTime();
          const tb = new Date(b.occurred_at || b.created_at || 0).getTime();
          return tb - ta;
        })
        .slice(0, 5)
        .map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          severity: normalizeSeverity(row.severity),
          occurred_at: row.occurred_at,
          created_at: row.created_at,
        }));

      // Get unread alerts
      const { data: unreadAlerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('is_read', false)
        .or(buildRecommendationFilter(userAccountId))
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent events for trends (last 30 days, grouped by day)
      const { data: trends } = await applyEventTimeWindow(
        supabase
          .from('events')
          .select('id, created_at, occurred_at, severity')
          .eq('organization_id', organization_id)
          .is('deleted_at', null)
          .order('occurred_at', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true }),
        dateFrom30dIso
      );

      const recentEventIds = (trends || []).map((event: any) => event.id);

      // Process trends data (group by day)
      const trendMap = new Map<string, { value: number; date: string }>();
      trends?.forEach((event: any) => {
        const date = new Date(event.occurred_at || event.created_at).toLocaleDateString('zh-CN');
        trendMap.set(date, { ...(trendMap.get(date) || { date, value: 0 }), value: (trendMap.get(date)?.value || 0) + 1 });
      });

      const trendsArray = Array.from(trendMap.values()).slice(-7); // Last 7 days

      // Get risk distribution
      const { data: riskData } = await applyEventTimeWindow(
        supabase
          .from('events')
          .select('event_type_id')
          .eq('organization_id', organization_id)
          .is('deleted_at', null),
        dateFrom30dIso
      );

      const riskMap = new Map<string, number>();
      riskData?.forEach((event: any) => {
        const type = event.event_type_id || 'unknown';
        riskMap.set(type, (riskMap.get(type) || 0) + 1);
      });

      const riskDistribution = Array.from(riskMap.entries()).map(([type, count]) => ({
        name: type,
        value: count,
      }));

      // Get active subscriptions count
      const { count: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .eq('is_active', true);

      // Get portrait statistics (prefer new portrait tables, fallback to legacy user_account fields)
      let totalPortraitRows = 0;
      let latestPortraitUpdatedAt: string | null = null;
      let totalPortraitVersions = 0;

      const [rowsResp, configResp, versionsResp] = await Promise.all([
        supabase
          .from('product_portrait_rows')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization_id)
          .eq('user_id', userId),
        supabase
          .from('product_portrait_config')
          .select('updated_at')
          .eq('organization_id', organization_id)
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('product_portrait_versions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization_id)
          .eq('user_id', userId),
      ]);

      const portraitTableMissing =
        String((rowsResp as any).error?.code || '') === 'PGRST205' ||
        String((configResp as any).error?.code || '') === 'PGRST205';

      if (!portraitTableMissing) {
        totalPortraitRows = rowsResp.count || 0;
        latestPortraitUpdatedAt = ((configResp as any).data as any)?.updated_at || null;
        totalPortraitVersions = versionsResp.count || 0;
      } else {
        const { data: legacyPortrait } = await supabase
          .from('user_account')
          .select('product_portrait_rows, product_portrait_updated_at')
          .eq('id', userAccountId)
          .limit(1)
          .maybeSingle();

        totalPortraitRows = Array.isArray((legacyPortrait as any)?.product_portrait_rows)
          ? (legacyPortrait as any).product_portrait_rows.length
          : 0;
        latestPortraitUpdatedAt = (legacyPortrait as any)?.product_portrait_updated_at || null;
        totalPortraitVersions = 0;
      }

      // Coverage rate: percent of recent events that have at least one location
      let coverageRate = 0;
      if (recentEventIds.length > 0) {
        const { data: locationRows } = await supabase
          .from('event_locations')
          .select('event_id')
          .in('event_id', recentEventIds);

        const locatedEventIds = new Set((locationRows || []).map((row: any) => row.event_id));
        coverageRate = Number(((locatedEventIds.size / recentEventIds.length) * 100).toFixed(1));
      }

      // Get risk assessment
      const { data: riskAssessment } = await supabase
        .from('risk_assessments')
        .select('*')
        .eq('organization_id', organization_id)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .single();

      // Get top locations for critical regions
      const { data: criticalEventRows } = await supabase
        .from('events')
        .select('id')
        .eq('organization_id', organization_id)
        .in('severity', ['critical'])
        .or(`occurred_at.gte.${dateFrom30dIso},and(occurred_at.is.null,created_at.gte.${dateFrom30dIso})`)
        .is('deleted_at', null);

      const criticalEventIds = (criticalEventRows || []).map((event: any) => event.id);
      let criticalRegionStats: Array<{ name: string; count: number }> = [];

      if (criticalEventIds.length > 0) {
        const { data: locations } = await supabase
          .from('event_locations')
          .select('location_name, event_id')
          .in('event_id', criticalEventIds);

        const regionMap = new Map<string, Set<string>>();
        (locations || []).forEach((location: any) => {
          const name = location.location_name || '未标注';
          if (!regionMap.has(name)) {
            regionMap.set(name, new Set<string>());
          }
          regionMap.get(name)!.add(location.event_id);
        });

        criticalRegionStats = Array.from(regionMap.entries())
          .map(([name, eventSet]) => ({ name, count: eventSet.size }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      }

      // Get latest major events (real-time from events table)
      const { data: recentEvents } = await supabase
        .from('events')
        .select(
          `
          id,
          title,
          description,
          severity,
          created_at,
          occurred_at,
          event_locations(location_name)
          `
        )
        .eq('organization_id', organization_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(3);

      const criticalRegions = criticalRegionStats.map((region) => region.name);

      const dashboardData: DashboardData = {
        metrics: {
          total_events_7d: totalEvents7d || 0,
          total_events_30d: totalEvents30d || 0,
          high_risk_events: highRiskEvents || 0,
          coverage_rate: coverageRate,
          active_subscriptions: activeSubscriptions || 0,
        },
        portrait_stats: {
          total_rows: totalPortraitRows || 0,
          total_versions: totalPortraitVersions || 0,
          last_updated_at: latestPortraitUpdatedAt,
        },
        high_risk_stats: {
          critical_count: severitySummary.critical,
          warning_count: severitySummary.warning,
          total_count: highRiskEvents,
          latest_high_risk_events: latestHighRiskEvents,
        },
        alerts: unreadAlerts || [],
        trends: trendsArray,
        risk_distribution: riskDistribution,
        global_risk_index: riskAssessment?.global_risk_index ?? null,
        critical_regions: (criticalRegions as string[]) || [],
        critical_region_stats: criticalRegionStats,
        recent_events: recentEvents || [],
      };

      res.json({ success: true, data: dashboardData });
    } catch (error: any) {
      console.error('Dashboard error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get metrics summary
  async getMetrics(req: AuthRequest, res: Response) {
    try {
      const organization_id = req.organization_id;

      const { data: metrics, error } = await supabase
        .from('dashboard_metrics')
        .select('*')
        .eq('organization_id', organization_id)
        .order('metric_date', { ascending: false })
        .limit(10);

      if (error) throw error;

      res.json({ success: true, data: metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get risk index
  async getRiskIndex(req: AuthRequest, res: Response) {
    try {
      const organization_id = req.organization_id;

      const { data: riskAssessment, error } = await supabase
        .from('risk_assessments')
        .select('*')
        .eq('organization_id', organization_id)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      res.json({
        success: true,
        data: riskAssessment || null,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
