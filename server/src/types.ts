import { Request } from 'express';

// ================================
// Type Definitions for Backend
// ================================

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: 'viewer' | 'analyst' | 'admin';
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  industry?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  hs_code?: string;
  gpc_code?: string;
  category?: string;
  description?: string;
  supply_chain_stage?: string;
  created_at: string;
  updated_at: string;
}

export interface EventType {
  id: string;
  name: string;
  description?: string;
  category: string;
  severity_hint?: string;
  icon_name?: string;
  created_at: string;
}

export interface Event {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  event_type_id?: string;
  severity: 'critical' | 'warning' | 'info';
  confidence_score: number;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  // 新增字段：事件细节
  cover_image?: string;
  source_links?: string[];
  media_keywords?: string[];
  key_takeaway?: string;
  predicted_recovery_days?: number;
  locations?: EventLocation[];
  sources?: EventSource[];
  evidence_chain?: EvidenceItem[];
  impacts?: EventImpact[];
  products?: EventProduct[];
}

export interface EventLocation {
  id: string;
  event_id: string;
  location_name: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  supply_chain_node?: string;
  created_at: string;
}

export interface EventSource {
  id: string;
  event_id: string;
  source_type: 'news' | 'official' | 'social' | 'sensor';
  source_name: string;
  source_url?: string;
  summary?: string;
  original_content?: string;
  publish_date?: string;
  credibility_score: number;
  created_at: string;
}

export interface EvidenceItem {
  id: string;
  event_id: string;
  time_recorded: string;
  description: string;
  evidence_type: 'source' | 'observation' | 'impact' | 'analysis';
  source: string;
  supporting_url?: string;
  sequence_order: number;
  created_at: string;
}

export interface EventImpact {
  id: string;
  event_id: string;
  product_id?: string;
  impact_type: string;
  estimated_impact?: string;
  affected_area?: string;
  supply_chain_stage?: string;
  recovery_days?: number;
  created_at: string;
}

export interface EventProduct {
  product_tier3_id?: string;
  product_tier3_code_dict?: {
    tier3_code: string;
    tier3_name: string;
  };
}

export interface Alert {
  id: string;
  organization_id: string;
  event_id?: string;
  title: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info';
  alert_type: 'new_event' | 'impact_update' | 'recommendation';
  is_read: boolean;
  read_at?: string;
  triggered_at: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  organization_id: string;
  subscription_type: 'location' | 'keyword' | 'product' | 'risk_type';
  filter_value: string;
  is_active: boolean;
  notify_channel: 'email' | 'sms' | 'in_app';
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  id: string;
  organization_id: string;
  metric_date: string;
  metric_type: string;
  metric_value: number;
  time_range: '7days' | '30days' | '90days';
  created_at: string;
}

export interface RiskAssessment {
  id: string;
  organization_id: string;
  assessment_date: string;
  global_risk_index: number;
  high_risk_events_count: number;
  critical_regions: string[];
  trend: 'up' | 'down' | 'stable';
  created_at: string;
}

export interface ExportReport {
  id: string;
  organization_id: string;
  user_id: string;
  export_type: 'event_list' | 'map_snapshot' | 'summary';
  file_name: string;
  file_url?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Query Filter Types
export interface EventFilter {
  organization_id?: string;
  severity?: 'critical' | 'warning' | 'info';
  event_type_id?: string;
  date_from?: string;
  date_to?: string;
  location?: string;
  confidence_min?: number;
  page?: number;
  per_page?: number;
  sort_by?: 'created_at' | 'occurred_at' | 'confidence_score' | 'severity';
  sort_order?: 'asc' | 'desc';
}

export interface AlertFilter {
  organization_id?: string;
  is_read?: boolean;
  severity?: 'critical' | 'warning' | 'info';
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

// ================================
// Authentication & Authorization Types
// ================================

export interface Permission {
  id: number;
  code: string;
  name: string;
  level: number; // 1=VIEWER, 2=EDITOR, 3=ADMIN
}

export interface UserInfo {
  id?: number;
  userId: number;
  username: string;
  email?: string;
  permissions?: Permission[];
}

declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
      organization_id?: string;
    }
  }
}

export type AuthRequest = Request;
