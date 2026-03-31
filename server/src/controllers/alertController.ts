import { Response } from 'express';
import { supabase } from '../utils/db';
import { Alert, PaginatedResponse } from '../types';
import { AuthRequest } from '../middleware';

async function resolveUserAccountId(req: AuthRequest): Promise<number> {
  const rawId = Number(req.user?.id || req.user?.userId);
  if (Number.isFinite(rawId) && rawId > 0) {
    const { data: byId } = await supabase.from('user_account').select('id').eq('id', rawId).limit(1).maybeSingle();
    if (byId?.id) return Number(byId.id);
  }

  const username = String((req.user as any)?.username || '').trim();
  if (username) {
    const { data } = await supabase.from('user_account').select('id').eq('username', username).limit(1).maybeSingle();
    if (data?.id) return Number(data.id);
  }

  const email = String(req.user?.email || '').trim();
  if (email) {
    const { data } = await supabase.from('user_account').select('id').eq('email', email).limit(1).maybeSingle();
    if (data?.id) return Number(data.id);
  }

  return rawId > 0 ? rawId : 0;
}

function buildRecommendationFilter(userAccountId: number): string {
  return `alert_type.neq.recommendation,and(alert_type.eq.recommendation,title.ilike.[U${userAccountId}]%)`;
}

export const alertController = {
  // Get alerts for organization
  async getAlerts(req: AuthRequest, res: Response) {
    try {
      const {
        is_read,
        severity,
        page = 1,
        per_page = 20,
      } = req.query;

      const organization_id = req.organization_id;
      const userAccountId = await resolveUserAccountId(req);

      let query = supabase
        .from('alerts')
        .select('*', { count: 'exact' })
        .eq('organization_id', organization_id)
        .or(buildRecommendationFilter(userAccountId));

      if (is_read !== undefined) {
        query = query.eq('is_read', is_read === 'true');
      }

      if (severity && severity !== 'all') {
        query = query.eq('severity', severity);
      }

      const pageNum = parseInt(page as string) || 1;
      const pageSize = Math.min(parseInt(per_page as string) || 20, 100);
      const offset = (pageNum - 1) * pageSize;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      const response: PaginatedResponse<Alert> = {
        items: data || [],
        total: count || 0,
        page: pageNum,
        per_page: pageSize,
        total_pages: Math.ceil((count || 0) / pageSize),
      };

      res.json({ success: true, data: response });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Mark alert as read
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organization_id = req.organization_id;

      const { data: alert, error } = await supabase
        .from('alerts')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', organization_id)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data: alert });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Create alert
  async createAlert(req: AuthRequest, res: Response) {
    try {
      const { title, description, severity, alert_type, event_id } = req.body;
      const organization_id = req.organization_id;

      if (!title) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: title',
        });
      }

      const { data: alert, error } = await supabase
        .from('alerts')
        .insert({
          organization_id,
          title,
          description,
          severity: severity || 'info',
          alert_type: alert_type || 'new_event',
          event_id,
          triggered_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: alert });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Delete alert
  async deleteAlert(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organization_id = req.organization_id;

      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', id)
        .eq('organization_id', organization_id);

      if (error) throw error;

      res.json({ success: true, message: 'Alert deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
