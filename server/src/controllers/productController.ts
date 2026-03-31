import { Response } from 'express';
import { supabase } from '../utils/db';
import { Product } from '../types';
import { AuthRequest } from '../middleware';

type RiskSensitivity = 'low' | 'medium' | 'high';
type CodingSystem = 'HS' | 'GPC' | 'CUSTOM';

interface ProductProfileConfigPayload {
  focusIndustries: string[];
  riskSensitivity: RiskSensitivity;
  watchRegions: string[];
  minConfidence: number;
  notifyByEmail: boolean;
  trackSupplyStages: string[];
}

interface PortraitRowPayload {
  productLine: string;
  codingSystem: CodingSystem;
  codeValue: string;
  keywords: string[];
  focusRegions: string[];
  focusStages: string[];
}

interface PortraitVersionPayload {
  id: string;
  versionNo: number;
  createdAt: string;
  rowCount: number;
  rows: PortraitRowPayload[];
  actionType?: 'rows_update' | 'config_update' | 'rollback';
  configSnapshot?: ProductProfileConfigPayload;
}

interface PortraitRuntimeState {
  config: ProductProfileConfigPayload;
  rows: PortraitRowPayload[];
  versions: PortraitVersionPayload[];
}

const DEFAULT_PRODUCT_PROFILE_CONFIG: ProductProfileConfigPayload = {
  focusIndustries: ['消费电子'],
  riskSensitivity: 'medium',
  watchRegions: ['亚太'],
  minConfidence: 70,
  notifyByEmail: true,
  trackSupplyStages: ['生产制造', '港口码头'],
};

const portraitRuntimeStore = new Map<string, PortraitRuntimeState>();

const portraitRuntimeKey = (organizationId: string, userId: string) => `${organizationId}::${userId}`;

const getPortraitRuntimeState = (organizationId: string, userId: string): PortraitRuntimeState => {
  const key = portraitRuntimeKey(organizationId, userId);
  const current = portraitRuntimeStore.get(key);
  if (current) return current;

  const initial: PortraitRuntimeState = {
    config: { ...DEFAULT_PRODUCT_PROFILE_CONFIG },
    rows: [],
    versions: [],
  };
  portraitRuntimeStore.set(key, initial);
  return initial;
};

const setPortraitRuntimeState = (organizationId: string, userId: string, next: PortraitRuntimeState) => {
  portraitRuntimeStore.set(portraitRuntimeKey(organizationId, userId), next);
};

const isPortraitStorageMissingError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  if (code !== 'PGRST205') return false;
  return (
    message.includes('product_portrait_config') ||
    message.includes('product_portrait_rows') ||
    message.includes('product_portrait_versions')
  );
};

const isUserAccountPortraitColumnMissingError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('product_portrait_config') ||
    message.includes('product_portrait_rows') ||
    message.includes('product_portrait_updated_at')
  );
};

async function loadLegacyPortraitFromUserAccount(userAccountId: number): Promise<{
  config: ProductProfileConfigPayload;
  rows: PortraitRowPayload[];
}> {
  const { data, error } = await supabase
    .from('user_account')
    .select('product_portrait_config, product_portrait_rows')
    .eq('id', userAccountId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const config = sanitizeConfig((data as any)?.product_portrait_config || DEFAULT_PRODUCT_PROFILE_CONFIG);
  const rows = sanitizePortraitRows((data as any)?.product_portrait_rows || []);
  return { config, rows };
}

async function saveLegacyPortraitConfigToUserAccount(userAccountId: number, config: ProductProfileConfigPayload) {
  const { error } = await updateUserAccountPortrait(userAccountId, {
    product_portrait_config: config,
    product_portrait_updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function saveLegacyPortraitRowsToUserAccount(userAccountId: number, rows: PortraitRowPayload[]) {
  const { error } = await updateUserAccountPortrait(userAccountId, {
    product_portrait_rows: rows,
    product_portrait_updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 100);
};

const sanitizeConfig = (raw: unknown): ProductProfileConfigPayload => {
  const data = (raw || {}) as Partial<ProductProfileConfigPayload>;
  const minConfidence = Math.max(40, Math.min(100, Number(data.minConfidence ?? 70)));
  const sensitivity = ['low', 'medium', 'high'].includes(String(data.riskSensitivity))
    ? (data.riskSensitivity as RiskSensitivity)
    : 'medium';

  return {
    focusIndustries: sanitizeStringArray(data.focusIndustries),
    riskSensitivity: sensitivity,
    watchRegions: sanitizeStringArray(data.watchRegions),
    minConfidence,
    notifyByEmail: Boolean(data.notifyByEmail),
    trackSupplyStages: sanitizeStringArray(data.trackSupplyStages),
  };
};

const sanitizePortraitRows = (rows: unknown): PortraitRowPayload[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  const seen = new Set<string>();
  const result: PortraitRowPayload[] = [];

  for (const item of rows) {
    const raw = (item || {}) as Partial<PortraitRowPayload>;
    const productLine = String(raw.productLine || '').trim();
    const codingSystem = String(raw.codingSystem || '').toUpperCase() as CodingSystem;
    const codeValue = String(raw.codeValue || '').trim();

    if (!productLine || !codeValue || !['HS', 'GPC', 'CUSTOM'].includes(codingSystem)) {
      continue;
    }

    const key = `${productLine}__${codingSystem}__${codeValue}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    result.push({
      productLine,
      codingSystem,
      codeValue,
      keywords: sanitizeStringArray(raw.keywords),
      focusRegions: sanitizeStringArray(raw.focusRegions),
      focusStages: sanitizeStringArray(raw.focusStages),
    });
  }

  return result.slice(0, 5000);
};

const isMissingColumnUpdateTimeError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('update_time') && message.includes('does not exist');
};

async function updateUserAccountPortrait(userAccountId: number, patch: Record<string, any>) {
  const payloadWithUpdateTime = {
    ...patch,
    update_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('user_account')
    .update(payloadWithUpdateTime)
    .eq('id', userAccountId)
    .select('*')
    .maybeSingle();

  if (!error) {
    return { data, error: null };
  }

  if (!isMissingColumnUpdateTimeError(error)) {
    return { data: null, error };
  }

  const retry = await supabase
    .from('user_account')
    .update(patch)
    .eq('id', userAccountId)
    .select('*')
    .maybeSingle();

  return retry;
}

async function resolveUserAccountId(req: AuthRequest): Promise<number> {
  const rawId = Number(req.user?.id || req.user?.userId);
  if (Number.isFinite(rawId) && rawId > 0) {
    const { data: byId } = await supabase.from('user_account').select('id').eq('id', rawId).limit(1).maybeSingle();
    if (byId?.id) {
      return Number(byId.id);
    }
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

  // Never reuse other users' portrait data. If current login identity has no row, create one.
  const fallbackUsername = username || `demo_${Date.now()}`;
  const fallbackEmail = email || null;

  const { data: created, error: createError } = await supabase
    .from('user_account')
    .insert({
      username: fallbackUsername,
      password_hash: 'demo-password-hash',
      email: fallbackEmail,
      full_name: fallbackUsername,
      is_active: 1,
      login_count: 0,
    })
    .select('id')
    .maybeSingle();

  if (!createError && created?.id) {
    return Number(created.id);
  }

  // Handle race/unique conflict: another request may have created the row already.
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

  throw new Error(createError?.message || 'Failed to resolve user account for portrait persistence');
}

const resolveScope = async (req: AuthRequest) => {
  const organizationId = req.organization_id || '00000000-0000-0000-0000-000000000001';
  const userAccountId = await resolveUserAccountId(req);
  const userId = String(userAccountId);
  return { organizationId, userId, userAccountId };
};

async function getPortraitConfig(organizationId: string, userId: string): Promise<ProductProfileConfigPayload> {
  const { data, error } = await supabase
    .from('product_portrait_config')
    .select('focus_industries, risk_sensitivity, watch_regions, min_confidence, notify_by_email, track_supply_stages')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return DEFAULT_PRODUCT_PROFILE_CONFIG;
  }

  return {
    focusIndustries: Array.isArray(data.focus_industries) ? data.focus_industries : [],
    riskSensitivity: ['low', 'medium', 'high'].includes(String(data.risk_sensitivity))
      ? (data.risk_sensitivity as RiskSensitivity)
      : 'medium',
    watchRegions: Array.isArray(data.watch_regions) ? data.watch_regions : [],
    minConfidence: Math.max(40, Math.min(100, Number(data.min_confidence ?? 70))),
    notifyByEmail: Boolean(data.notify_by_email),
    trackSupplyStages: Array.isArray(data.track_supply_stages) ? data.track_supply_stages : [],
  };
}

async function ensurePortraitConfigRow(organizationId: string, userId: string): Promise<ProductProfileConfigPayload> {
  const config = await getPortraitConfig(organizationId, userId);

  const { error } = await supabase
    .from('product_portrait_config')
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        focus_industries: config.focusIndustries,
        risk_sensitivity: config.riskSensitivity,
        watch_regions: config.watchRegions,
        min_confidence: config.minConfidence,
        notify_by_email: config.notifyByEmail,
        track_supply_stages: config.trackSupplyStages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,user_id' }
    );

  if (error) throw error;
  return config;
}

async function getPortraitRows(organizationId: string, userId: string): Promise<PortraitRowPayload[]> {
  const { data, error } = await supabase
    .from('product_portrait_rows')
    .select('product_line, coding_system, code_value, keywords, focus_regions, focus_stages')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  return sanitizePortraitRows(
    (data || []).map((row: any) => ({
      productLine: row.product_line,
      codingSystem: row.coding_system,
      codeValue: row.code_value,
      keywords: row.keywords || [],
      focusRegions: row.focus_regions || [],
      focusStages: row.focus_stages || [],
    }))
  );
}

async function replacePortraitRows(organizationId: string, userId: string, rows: PortraitRowPayload[]) {
  const { error: deleteError } = await supabase
    .from('product_portrait_rows')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId);

  if (deleteError) {
    throw deleteError;
  }

  if (rows.length === 0) {
    return;
  }

  const insertRows = rows.map((row) => ({
    organization_id: organizationId,
    user_id: userId,
    product_line: row.productLine,
    coding_system: row.codingSystem,
    code_value: row.codeValue,
    keywords: row.keywords,
    focus_regions: row.focusRegions,
    focus_stages: row.focusStages,
    updated_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from('product_portrait_rows')
    .insert(insertRows);

  if (insertError) {
    throw insertError;
  }
}

const normalizeVersionSnapshot = (raw: any): { rows: PortraitRowPayload[]; config?: ProductProfileConfigPayload; actionType?: 'rows_update' | 'config_update' | 'rollback' } => {
  if (Array.isArray(raw)) {
    return { rows: sanitizePortraitRows(raw) };
  }

  const rows = sanitizePortraitRows(raw?.rows || []);
  const config = raw?.config ? sanitizeConfig(raw.config) : undefined;
  const actionType = ['rows_update', 'config_update', 'rollback'].includes(String(raw?.actionType))
    ? (raw.actionType as 'rows_update' | 'config_update' | 'rollback')
    : undefined;

  return { rows, config, actionType };
};

const buildVersionSnapshot = (
  rows: PortraitRowPayload[],
  config?: ProductProfileConfigPayload,
  actionType?: 'rows_update' | 'config_update' | 'rollback'
) => ({
  rows,
  config,
  actionType,
});

const mapVersionRecord = (version: any): PortraitVersionPayload => {
  const normalized = normalizeVersionSnapshot(version?.rows_snapshot);
  return {
    id: String(version.id),
    versionNo: version.version_no,
    createdAt: version.created_at,
    rowCount: version.row_count,
    rows: normalized.rows,
    actionType: normalized.actionType,
    configSnapshot: normalized.config,
  };
};

async function listPortraitVersions(organizationId: string, userId: string): Promise<PortraitVersionPayload[]> {
  const { data: versionsData, error: versionsError } = await supabase
    .from('product_portrait_versions')
    .select('id, version_no, row_count, created_at, rows_snapshot')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .order('version_no', { ascending: false })
    .limit(20);

  if (versionsError) {
    throw versionsError;
  }

  return (versionsData || []).map(mapVersionRecord);
}

async function appendPortraitVersion(
  organizationId: string,
  userId: string,
  rows: PortraitRowPayload[],
  config?: ProductProfileConfigPayload,
  actionType?: 'rows_update' | 'config_update' | 'rollback'
) {
  const { data: latestVersion, error: latestVersionError } = await supabase
    .from('product_portrait_versions')
    .select('version_no')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersionError) throw latestVersionError;

  const nextVersionNo = (latestVersion?.version_no || 0) + 1;

  const { error: versionError } = await supabase
    .from('product_portrait_versions')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      version_no: nextVersionNo,
      row_count: rows.length,
      rows_snapshot: buildVersionSnapshot(rows, config, actionType),
    });

  if (versionError) throw versionError;
}

export const productController = {
  // Get all products
  async getProducts(req: AuthRequest, res: Response) {
    try {
      const organization_id = req.organization_id;
      const { page = 1, per_page = 20 } = req.query;

      const pageNum = parseInt(page as string) || 1;
      const pageSize = Math.min(parseInt(per_page as string) || 20, 100);
      const offset = (pageNum - 1) * pageSize;

      const { data, count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('organization_id', organization_id)
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      res.json({
        success: true,
        data: {
          items: data || [],
          total: count || 0,
          page: pageNum,
          per_page: pageSize,
          total_pages: Math.ceil((count || 0) / pageSize),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Create product
  async createProduct(req: AuthRequest, res: Response) {
    try {
      const { name, hs_code, gpc_code, category, description, supply_chain_stage } = req.body;
      const organization_id = req.organization_id;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: name',
        });
      }

      const { data: product, error } = await supabase
        .from('products')
        .insert({
          organization_id,
          name,
          hs_code,
          gpc_code,
          category,
          description,
          supply_chain_stage,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: product });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Update product
  async updateProduct(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, hs_code, gpc_code, category, description, supply_chain_stage } = req.body;
      const organization_id = req.organization_id;

      const { data: product, error } = await supabase
        .from('products')
        .update({
          name,
          hs_code,
          gpc_code,
          category,
          description,
          supply_chain_stage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', organization_id)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data: product });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Delete product
  async deleteProduct(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organization_id = req.organization_id;

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('organization_id', organization_id);

      if (error) throw error;

      res.json({ success: true, message: 'Product deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

export const subscriptionController = {
  // Get user subscriptions
  async getSubscriptions(req: AuthRequest, res: Response) {
    try {
      const user_id = req.user?.id;
      const organization_id = req.organization_id;

      if (!user_id) {
        return res.status(400).json({ success: false, error: 'User not authenticated' });
      }

      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user_id)
        .eq('organization_id', organization_id)
        .eq('is_active', true);

      if (error) throw error;

      res.json({ success: true, data: subscriptions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Create subscription
  async createSubscription(req: AuthRequest, res: Response) {
    try {
      const { subscription_type, filter_value, notify_channel } = req.body;
      const user_id = req.user?.id;
      const organization_id = req.organization_id;

      if (!user_id) {
        return res.status(400).json({ success: false, error: 'User not authenticated' });
      }

      if (!subscription_type || !filter_value) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id,
          organization_id,
          subscription_type,
          filter_value,
          notify_channel: notify_channel || 'in_app',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: subscription });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Delete subscription
  async deleteSubscription(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const user_id = req.user?.id;

      if (!user_id) {
        return res.status(400).json({ success: false, error: 'User not authenticated' });
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user_id);

      if (error) throw error;

      res.json({ success: true, message: 'Subscription deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

export const productPortraitController = {
  async getProductPortrait(req: AuthRequest, res: Response) {
    try {
      const { organizationId, userId } = await resolveScope(req);

      const [config, rows, versions] = await Promise.all([
        ensurePortraitConfigRow(organizationId, userId),
        getPortraitRows(organizationId, userId),
        listPortraitVersions(organizationId, userId),
      ]);

      res.json({
        success: true,
        data: {
          config,
          rows,
          versions,
        },
      });
    } catch (error: any) {
      if (isPortraitStorageMissingError(error)) {
        const { organizationId, userId, userAccountId } = await resolveScope(req);

        try {
          const legacy = await loadLegacyPortraitFromUserAccount(userAccountId);
          return res.json({
            success: true,
            data: {
              config: legacy.config,
              rows: legacy.rows,
              versions: [],
            },
          });
        } catch (legacyError: any) {
          if (!isUserAccountPortraitColumnMissingError(legacyError)) {
            throw legacyError;
          }
        }

        const state = getPortraitRuntimeState(organizationId, userId);
        return res.json({ success: true, data: state });
      }
      console.error('getProductPortrait error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async saveProductPortraitConfig(req: AuthRequest, res: Response) {
    try {
      const { organizationId, userId } = await resolveScope(req);
      const config = sanitizeConfig(req.body);
      const rows = await getPortraitRows(organizationId, userId);

      const { error } = await supabase
        .from('product_portrait_config')
        .upsert(
          {
            organization_id: organizationId,
            user_id: userId,
            focus_industries: config.focusIndustries,
            risk_sensitivity: config.riskSensitivity,
            watch_regions: config.watchRegions,
            min_confidence: config.minConfidence,
            notify_by_email: config.notifyByEmail,
            track_supply_stages: config.trackSupplyStages,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,user_id' }
        );

      if (error) throw error;

      await appendPortraitVersion(organizationId, userId, rows, config, 'config_update');
      const versions = await listPortraitVersions(organizationId, userId);

      res.json({
        success: true,
        data: {
          config,
          versions,
        },
      });
    } catch (error: any) {
      if (isPortraitStorageMissingError(error)) {
        const { organizationId, userId, userAccountId } = await resolveScope(req);
        const config = sanitizeConfig(req.body);

        try {
          await saveLegacyPortraitConfigToUserAccount(userAccountId, config);
          return res.json({ success: true, data: { config, versions: [] } });
        } catch (legacyError: any) {
          if (!isUserAccountPortraitColumnMissingError(legacyError)) {
            throw legacyError;
          }
        }

        const state = getPortraitRuntimeState(organizationId, userId);
        const nextVersionNo = (state.versions[0]?.versionNo || 0) + 1;
        const newVersion: PortraitVersionPayload = {
          id: `${Date.now()}`,
          versionNo: nextVersionNo,
          createdAt: new Date().toISOString(),
          rowCount: state.rows.length,
          rows: state.rows,
          actionType: 'config_update',
          configSnapshot: config,
        };
        const nextState: PortraitRuntimeState = {
          ...state,
          config,
          versions: [newVersion, ...state.versions].slice(0, 20),
        };
        setPortraitRuntimeState(organizationId, userId, nextState);
        return res.json({ success: true, data: { config, versions: nextState.versions } });
      }
      console.error('saveProductPortraitConfig error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async saveProductPortraitRows(req: AuthRequest, res: Response) {
    try {
      const { organizationId, userId } = await resolveScope(req);
      const rows = sanitizePortraitRows(req.body?.rows);

      await replacePortraitRows(organizationId, userId, rows);

      const config = await getPortraitConfig(organizationId, userId);
      await appendPortraitVersion(organizationId, userId, rows, config, 'rows_update');

      const versions = await listPortraitVersions(organizationId, userId);

      res.json({ success: true, data: { rows, versions } });
    } catch (error: any) {
      if (isPortraitStorageMissingError(error)) {
        const { organizationId, userId, userAccountId } = await resolveScope(req);
        const rows = sanitizePortraitRows(req.body?.rows);

        try {
          await saveLegacyPortraitRowsToUserAccount(userAccountId, rows);
          return res.json({ success: true, data: { rows, versions: [] } });
        } catch (legacyError: any) {
          if (!isUserAccountPortraitColumnMissingError(legacyError)) {
            throw legacyError;
          }
        }

        const state = getPortraitRuntimeState(organizationId, userId);
        const nextVersionNo = (state.versions[0]?.versionNo || 0) + 1;
        const newVersion: PortraitVersionPayload = {
          id: `${Date.now()}`,
          versionNo: nextVersionNo,
          createdAt: new Date().toISOString(),
          rowCount: rows.length,
          rows,
        };
        const nextState: PortraitRuntimeState = {
          ...state,
          rows,
          versions: [newVersion, ...state.versions].slice(0, 20),
        };
        setPortraitRuntimeState(organizationId, userId, nextState);
        return res.json({ success: true, data: { rows: nextState.rows, versions: nextState.versions } });
      }
      console.error('saveProductPortraitRows error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async rollbackProductPortraitVersion(req: AuthRequest, res: Response) {
    try {
      const { organizationId, userId } = await resolveScope(req);
      const versionId = Number(req.body?.versionId);

      if (!versionId) {
        return res.status(400).json({ success: false, error: 'versionId is required' });
      }

      const { data: versionData, error: versionFetchError } = await supabase
        .from('product_portrait_versions')
        .select('rows_snapshot')
        .eq('id', versionId)
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single();

      if (versionFetchError) throw versionFetchError;

      const rollbackSnapshot = normalizeVersionSnapshot(versionData?.rows_snapshot);
      const rollbackRows = rollbackSnapshot.rows;
      await replacePortraitRows(organizationId, userId, rollbackRows);

      const config = rollbackSnapshot.config || (await getPortraitConfig(organizationId, userId));
      await appendPortraitVersion(organizationId, userId, rollbackRows, config, 'rollback');

      const versions = await listPortraitVersions(organizationId, userId);

      res.json({ success: true, data: { rows: rollbackRows, versions } });
    } catch (error: any) {
      if (isPortraitStorageMissingError(error)) {
        const { organizationId, userId, userAccountId } = await resolveScope(req);
        const versionId = String(req.body?.versionId || '');

        try {
          const legacy = await loadLegacyPortraitFromUserAccount(userAccountId);
          return res.json({ success: true, data: { rows: legacy.rows, versions: [] } });
        } catch (legacyError: any) {
          if (!isUserAccountPortraitColumnMissingError(legacyError)) {
            throw legacyError;
          }
        }

        const state = getPortraitRuntimeState(organizationId, userId);
        const target = state.versions.find((item) => item.id === versionId || String(item.versionNo) === versionId);
        if (!target) {
          return res.status(404).json({ success: false, error: '未找到可回滚版本' });
        }

        const nextVersionNo = (state.versions[0]?.versionNo || 0) + 1;
        const rollbackVersion: PortraitVersionPayload = {
          id: `${Date.now()}`,
          versionNo: nextVersionNo,
          createdAt: new Date().toISOString(),
          rowCount: target.rows.length,
          rows: target.rows,
        };

        const nextState: PortraitRuntimeState = {
          ...state,
          rows: target.rows,
          versions: [rollbackVersion, ...state.versions].slice(0, 20),
        };
        setPortraitRuntimeState(organizationId, userId, nextState);
        return res.json({ success: true, data: { rows: nextState.rows, versions: nextState.versions } });
      }
      console.error('rollbackProductPortraitVersion error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async getProductPortraitOptions(req: AuthRequest, res: Response) {
    try {
      const { organizationId, userId } = await resolveScope(req);

      const pickNames = (rows: any[], keys: string[]) => {
        return rows
          .map((row) => {
            for (const key of keys) {
              const value = String((row as any)?.[key] || '').trim();
              if (value) return value;
            }
            return '';
          })
          .filter(Boolean);
      };

      const safeLoad = async (table: string, keys: string[], limit = 500): Promise<string[]> => {
        const { data, error } = await supabase.from(table).select('*').limit(limit);
        if (error || !Array.isArray(data)) {
          return [];
        }
        return pickNames(data, keys);
      };

      const [
        tier1Industries,
        tier2Industries,
        tier3Industries,
        tier1Codes,
        tier2Codes,
        tier3Codes,
        regions,
        countries,
        supplyTier1,
        supplyTier2,
        sourceNames,
        userPortraitRows,
        userPortraitConfig,
      ] = await Promise.all([
        safeLoad('product_tier1_code_dict', ['tier1_name']),
        safeLoad('product_tier2_code_dict', ['tier2_name']),
        safeLoad('product_tier3_code_dict', ['tier3_name']),
        safeLoad('product_tier1_code_dict', ['tier1_code']),
        safeLoad('product_tier2_code_dict', ['tier2_code']),
        safeLoad('product_tier3_code_dict', ['tier3_code']),
        safeLoad('un_region_dict', ['region_name', 'un_region_name', 'name']),
        safeLoad('country_code_dict', ['country_name_cn', 'country_name', 'name']),
        safeLoad('supplychain_tier1_dict', ['tier1_name']),
        safeLoad('supplychain_tier2_dict', ['tier2_name']),
        safeLoad('media_data_source_dict', ['source_name']),
        supabase
          .from('product_portrait_rows')
          .select('product_line, focus_regions, focus_stages')
          .eq('organization_id', organizationId)
          .eq('user_id', userId),
        supabase
          .from('product_portrait_config')
          .select('focus_industries, watch_regions, track_supply_stages')
          .eq('organization_id', organizationId)
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle(),
      ]);

      const portraitRows = Array.isArray(userPortraitRows.data) ? userPortraitRows.data : [];
      const portraitConfig = (userPortraitConfig.data as any) || {};

      const rowIndustries = portraitRows
        .map((row: any) => String(row?.product_line || '').trim())
        .filter(Boolean);
      const rowRegions = portraitRows
        .flatMap((row: any) => (Array.isArray(row?.focus_regions) ? row.focus_regions : []))
        .map((value: any) => String(value || '').trim())
        .filter(Boolean);
      const rowStages = portraitRows
        .flatMap((row: any) => (Array.isArray(row?.focus_stages) ? row.focus_stages : []))
        .map((value: any) => String(value || '').trim())
        .filter(Boolean);

      const focusIndustries = Array.isArray((portraitConfig as any).focus_industries) ? (portraitConfig as any).focus_industries : [];
      const watchRegions = Array.isArray((portraitConfig as any).watch_regions) ? (portraitConfig as any).watch_regions : [];
      const trackSupplyStages = Array.isArray((portraitConfig as any).track_supply_stages) ? (portraitConfig as any).track_supply_stages : [];
      const rowCodes = portraitRows
        .map((row: any) => String(row?.code_value || '').trim())
        .filter(Boolean);
      const rowKeywords = portraitRows
        .flatMap((row: any) => (Array.isArray(row?.keywords) ? row.keywords : []))
        .map((value: any) => String(value || '').trim())
        .filter(Boolean);

      const uniq = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 200);

      res.json({
        success: true,
        data: {
          productOptions: uniq([...focusIndustries, ...rowIndustries, ...tier1Industries, ...tier2Industries, ...tier3Industries]),
          industryOptions: uniq([...focusIndustries, ...rowIndustries, ...tier1Industries, ...tier2Industries, ...tier3Industries]),
          regionOptions: uniq([...watchRegions, ...rowRegions, ...regions, ...countries]),
          supplyStageOptions: uniq([...trackSupplyStages, ...rowStages, ...supplyTier1, ...supplyTier2]),
          codeValueOptions: uniq([...rowCodes, ...tier1Codes, ...tier2Codes, ...tier3Codes]),
          featureKeywordOptions: uniq(rowKeywords),
          sourceOptions: uniq(sourceNames),
          codingSystemOptions: ['HS', 'GPC', 'CUSTOM'],
        },
      });
    } catch (error: any) {
      if (isPortraitStorageMissingError(error)) {
        const { organizationId, userId, userAccountId } = await resolveScope(req);

        try {
          const legacy = await loadLegacyPortraitFromUserAccount(userAccountId);
          return res.json({
            success: true,
            data: {
              productOptions: Array.from(new Set([...legacy.config.focusIndustries, ...legacy.rows.map((r) => r.productLine)])).slice(0, 200),
              industryOptions: Array.from(new Set([...legacy.config.focusIndustries, ...legacy.rows.map((r) => r.productLine)])).slice(0, 200),
              regionOptions: Array.from(new Set([...legacy.config.watchRegions, ...legacy.rows.flatMap((r) => r.focusRegions)])).slice(0, 200),
              supplyStageOptions: Array.from(new Set([...legacy.config.trackSupplyStages, ...legacy.rows.flatMap((r) => r.focusStages)])).slice(0, 200),
              codeValueOptions: Array.from(new Set(legacy.rows.map((r) => r.codeValue))).slice(0, 200),
              featureKeywordOptions: Array.from(new Set(legacy.rows.flatMap((r) => r.keywords))).slice(0, 200),
              sourceOptions: [],
              codingSystemOptions: ['HS', 'GPC', 'CUSTOM'],
            },
          });
        } catch (legacyError: any) {
          if (!isUserAccountPortraitColumnMissingError(legacyError)) {
            throw legacyError;
          }
        }

        const state = getPortraitRuntimeState(organizationId, userId);
        return res.json({
          success: true,
          data: {
            productOptions: Array.from(new Set([...state.config.focusIndustries, ...state.rows.map((r) => r.productLine)])).slice(0, 200),
            industryOptions: Array.from(new Set([...state.config.focusIndustries, ...state.rows.map((r) => r.productLine)])).slice(0, 200),
            regionOptions: Array.from(new Set([...state.config.watchRegions, ...state.rows.flatMap((r) => r.focusRegions)])).slice(0, 200),
            supplyStageOptions: Array.from(new Set([...state.config.trackSupplyStages, ...state.rows.flatMap((r) => r.focusStages)])).slice(0, 200),
            codeValueOptions: Array.from(new Set(state.rows.map((r) => r.codeValue))).slice(0, 200),
            featureKeywordOptions: Array.from(new Set(state.rows.flatMap((r) => r.keywords))).slice(0, 200),
            sourceOptions: [],
            codingSystemOptions: ['HS', 'GPC', 'CUSTOM'],
          },
        });
      }
      console.error('getProductPortraitOptions error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
