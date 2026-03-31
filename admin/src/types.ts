export interface Permission {
  id: number;
  code: 'ADMIN' | 'EDITOR' | 'VIEWER' | string;
  name: string;
  level: number;
}

export interface UserItem {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  isActive: number;
  loginCount?: number;
  lastLogin?: string;
  permissions: Permission[];
}

export interface DictionaryResponse<T = Record<string, unknown>> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface ProductItem {
  id: string;
  name: string;
  hs_code?: string;
  gpc_code?: string;
  category?: string;
  description?: string;
  supply_chain_stage?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductPageResponse {
  items: ProductItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface EventItem {
  id: string;
  title: string;
  description?: string;
  cover_image?: string;
  cover_url?: string;
  image_url?: string;
  image?: string;
  event_type_id?: string;
  severity?: 'critical' | 'warning' | 'info' | string;
  confidence_score?: number;
  occurred_at: string;
  event_locations?: Array<{
    location_name?: string;
  }>;
  event_impacts?: Array<{
    impact_type?: string;
    supply_chain_stage?: string;
    affected_area?: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface EventPageResponse {
  items: EventItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
