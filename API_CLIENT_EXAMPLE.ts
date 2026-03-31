// 前端 API 调用示例和工具类
// 位置在前端src中时应为：src/utils/api.ts

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const DEFAULT_ORG_ID = import.meta.env.VITE_ORG_ID || 'demo-org-id';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

class ApiClient {
  private baseUrl: string;
  private defaultOrgId: string;

  constructor(baseUrl: string = API_BASE_URL, defaultOrgId: string = DEFAULT_ORG_ID) {
    this.baseUrl = baseUrl;
    this.defaultOrgId = defaultOrgId;
  }

  private getHeaders(orgId?: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-Organization-ID': orgId || this.defaultOrgId,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    orgId?: string
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders(orgId);

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...(options.headers as HeadersInit) },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // =====================
  // Dashboard Endpoints
  // =====================

  async getDashboard(timeRange: '7days' | '30days' | '90days' = '7days', orgId?: string) {
    return this.request(`/dashboard?time_range=${timeRange}`, {}, orgId);
  }

  async getMetrics(orgId?: string) {
    return this.request('/dashboard/metrics', {}, orgId);
  }

  async getRiskIndex(orgId?: string) {
    return this.request('/dashboard/risk-index', {}, orgId);
  }

  // =====================
  // Event Endpoints
  // =====================

  async getEvents(
    filter?: {
      page?: number;
      per_page?: number;
      severity?: string;
      date_from?: string;
      date_to?: string;
      sort_by?: string;
      sort_order?: string;
    },
    orgId?: string
  ) {
    const params = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }

    const endpoint = `/events${params.toString() ? '?' + params.toString() : ''}`;
    return this.request<PaginatedResponse<any>>(endpoint, {}, orgId);
  }

  async getEventById(eventId: string, orgId?: string) {
    return this.request(`/events/${eventId}`, {}, orgId);
  }

  async createEvent(
    data: {
      title: string;
      description?: string;
      event_type_id?: string;
      severity?: string;
      confidence_score?: number;
      occurred_at: string;
      locations?: any[];
      sources?: any[];
    },
    orgId?: string
  ) {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }, orgId);
  }

  async updateEvent(eventId: string, data: any, orgId?: string) {
    return this.request(`/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, orgId);
  }

  async deleteEvent(eventId: string, orgId?: string) {
    return this.request(`/events/${eventId}`, {
      method: 'DELETE',
    }, orgId);
  }

  async addEvidence(
    eventId: string,
    evidence: {
      time_recorded: string;
      description: string;
      evidence_type?: string;
      source?: string;
      supporting_url?: string;
      sequence_order?: number;
    },
    orgId?: string
  ) {
    return this.request(`/events/${eventId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(evidence),
    }, orgId);
  }

  // =====================
  // Alert Endpoints
  // =====================

  async getAlerts(
    filter?: {
      page?: number;
      per_page?: number;
      is_read?: boolean;
      severity?: string;
    },
    orgId?: string
  ) {
    const params = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }

    const endpoint = `/alerts${params.toString() ? '?' + params.toString() : ''}`;
    return this.request<PaginatedResponse<any>>(endpoint, {}, orgId);
  }

  async createAlert(
    data: {
      title: string;
      description?: string;
      severity?: string;
      alert_type?: string;
      event_id?: string;
    },
    orgId?: string
  ) {
    return this.request('/alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    }, orgId);
  }

  async markAlertAsRead(alertId: string, orgId?: string) {
    return this.request(`/alerts/${alertId}/read`, {
      method: 'PUT',
    }, orgId);
  }

  async deleteAlert(alertId: string, orgId?: string) {
    return this.request(`/alerts/${alertId}`, {
      method: 'DELETE',
    }, orgId);
  }

  // =====================
  // Product Endpoints
  // =====================

  async getProducts(
    filter?: {
      page?: number;
      per_page?: number;
    },
    orgId?: string
  ) {
    const params = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }

    const endpoint = `/management/products${params.toString() ? '?' + params.toString() : ''}`;
    return this.request<PaginatedResponse<any>>(endpoint, {}, orgId);
  }

  async createProduct(
    data: {
      name: string;
      hs_code?: string;
      gpc_code?: string;
      category?: string;
      description?: string;
      supply_chain_stage?: string;
    },
    orgId?: string
  ) {
    return this.request('/management/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }, orgId);
  }

  async updateProduct(productId: string, data: any, orgId?: string) {
    return this.request(`/management/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, orgId);
  }

  async deleteProduct(productId: string, orgId?: string) {
    return this.request(`/management/products/${productId}`, {
      method: 'DELETE',
    }, orgId);
  }

  // =====================
  // Subscription Endpoints
  // =====================

  async getSubscriptions(orgId?: string) {
    return this.request('/management/subscriptions', {}, orgId);
  }

  async createSubscription(
    data: {
      subscription_type: string;
      filter_value: string;
      notify_channel?: string;
    },
    orgId?: string
  ) {
    return this.request('/management/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    }, orgId);
  }

  async deleteSubscription(subscriptionId: string, orgId?: string) {
    return this.request(`/management/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    }, orgId);
  }
}

// 导出单例实例
export const apiClient = new ApiClient();
export type { ApiResponse, PaginatedResponse };
export default apiClient;
