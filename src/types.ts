export interface Metric {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: string;
  color?: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  time: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  type: string;
  impact: string;
  confidence: number;
  severity: 'critical' | 'warning' | 'info';
}

export type ViewType = 'dashboard' | 'map' | 'events' | 'detail' | 'supply-chain' | 'profile' | 'login';
