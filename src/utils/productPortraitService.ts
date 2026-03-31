import { API_BASE_URL, authorizedFetch } from './authService';

export interface ProductProfileConfig {
  focusIndustries: string[];
  riskSensitivity: 'low' | 'medium' | 'high';
  watchRegions: string[];
  minConfidence: number;
  notifyByEmail: boolean;
  trackSupplyStages: string[];
}

export interface PortraitRow {
  productLine: string;
  codingSystem: 'HS' | 'GPC' | 'CUSTOM';
  codeValue: string;
  keywords: string[];
  focusRegions: string[];
  focusStages: string[];
}

export interface PortraitVersion {
  id: string;
  versionNo?: number;
  createdAt: string;
  rowCount: number;
  rows: PortraitRow[];
  actionType?: 'rows_update' | 'config_update' | 'rollback';
  configSnapshot?: ProductProfileConfig;
}

export interface ProductPortraitPayload {
  config: ProductProfileConfig;
  rows: PortraitRow[];
  versions: PortraitVersion[];
}

export interface SaveProductPortraitConfigResult {
  config: ProductProfileConfig;
  versions?: PortraitVersion[];
}

export interface ProductPortraitOptionsPayload {
  productOptions?: string[];
  industryOptions: string[];
  regionOptions: string[];
  supplyStageOptions: string[];
  codeValueOptions?: string[];
  featureKeywordOptions?: string[];
  sourceOptions: string[];
  codingSystemOptions: Array<'HS' | 'GPC' | 'CUSTOM'>;
}

async function parseApiResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || data?.message || fallbackError);
  }

  return data.data as T;
}

export async function fetchProductPortrait(): Promise<ProductPortraitPayload> {
  const response = await authorizedFetch(`${API_BASE_URL}/management/product-portrait`);
  return parseApiResponse<ProductPortraitPayload>(response, '读取产品画像配置失败');
}

export async function fetchProductPortraitOptions(): Promise<ProductPortraitOptionsPayload> {
  const response = await authorizedFetch(`${API_BASE_URL}/management/product-portrait/options`);
  return parseApiResponse<ProductPortraitOptionsPayload>(response, '读取画像选项失败');
}

export async function saveProductPortraitConfig(config: ProductProfileConfig): Promise<SaveProductPortraitConfigResult> {
  const response = await authorizedFetch(`${API_BASE_URL}/management/product-portrait/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });

  const payload = await parseApiResponse<any>(response, '保存产品画像配置失败');
  if (payload && typeof payload === 'object' && 'config' in payload) {
    return {
      config: payload.config as ProductProfileConfig,
      versions: Array.isArray(payload.versions) ? (payload.versions as PortraitVersion[]) : undefined,
    };
  }

  return { config: payload as ProductProfileConfig };
}

export async function saveProductPortraitRows(rows: PortraitRow[]): Promise<Pick<ProductPortraitPayload, 'rows' | 'versions'>> {
  const response = await authorizedFetch(`${API_BASE_URL}/management/product-portrait/rows`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });

  return parseApiResponse<Pick<ProductPortraitPayload, 'rows' | 'versions'>>(response, '保存画像数据失败');
}

export async function rollbackProductPortraitVersion(versionId: string): Promise<Pick<ProductPortraitPayload, 'rows' | 'versions'>> {
  const response = await authorizedFetch(`${API_BASE_URL}/management/product-portrait/rollback`, {
    method: 'POST',
    body: JSON.stringify({ versionId: Number(versionId) }),
  });

  return parseApiResponse<Pick<ProductPortraitPayload, 'rows' | 'versions'>>(response, '回滚画像版本失败');
}
