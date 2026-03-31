# 前后端集成指南

## 概述

本指南说明如何在前端代码中集成后台 API。

## 1. 设置 API 客户端

在前端创建一个 API 或 HTTP 客户端来与后台通信。

### 前端位置：`src/utils/api.ts`

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// 添加组织 ID header
const getHeaders = (organizationId?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (organizationId) {
    headers['X-Organization-ID'] = organizationId;
  }

  return headers;
};

// 通用 API 调用函数
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  organizationId?: string
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = getHeaders(organizationId);

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API Error');
  }

  return response.json();
}

export { apiCall, API_BASE_URL };
```

### .env 配置

在 `.env.local` 中添加：

```env
VITE_API_URL=http://localhost:3001/api
VITE_ORG_ID=demo-org-id
```

## 2. 在各个视图中集成 API

### Dashboard.tsx

```typescript
import { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';

export const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const orgId = import.meta.env.VITE_ORG_ID;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await apiCall('/dashboard', {}, orgId);
        setDashboardData(data.data);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 使用 dashboardData 渲染组件...
};
```

### EventLibrary.tsx

```typescript
export const EventLibrary: React.FC = () => {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({
    severity: 'all',
    page: 1,
    per_page: 20,
  });
  const orgId = import.meta.env.VITE_ORG_ID;

  useEffect(() => {
    const fetchEvents = async () => {
      const queryParams = new URLSearchParams(filters).toString();
      const data = await apiCall(`/events?${queryParams}`, {}, orgId);
      setEvents(data.data.items);
    };

    fetchEvents();
  }, [filters]);

  // 处理事件过滤...
};
```

### EventDetail.tsx

```typescript
export const EventDetail: React.FC<{ eventId: string }> = ({ eventId }) => {
  const [event, setEvent] = useState(null);
  const orgId = import.meta.env.VITE_ORG_ID;

  useEffect(() => {
    const fetchEvent = async () => {
      const data = await apiCall(`/events/${eventId}`, {}, orgId);
      setEvent(data.data);
    };

    fetchEvent();
  }, [eventId]);

  // 显示事件详情...
};
```

## 3. 常见操作示例

### 获取指标

```typescript
const fetchMetrics = async (orgId: string) => {
  const response = await apiCall('/dashboard/metrics', {}, orgId);
  return response.data;
};
```

### 获取预警列表

```typescript
const fetchAlerts = async (orgId: string) => {
  const response = await apiCall(
    '/alerts?is_read=false&page=1&per_page=10',
    {},
    orgId
  );
  return response.data.items;
};
```

### 创建事件

```typescript
const createEvent = async (
  orgId: string,
  eventData: {
    title: string;
    description: string;
    severity: string;
    occurred_at: string;
  }
) => {
  const response = await apiCall(
    '/events',
    {
      method: 'POST',
      body: JSON.stringify(eventData),
    },
    orgId
  );
  return response.data;
};
```

### 添加证据链

```typescript
const addEvidence = async (
  orgId: string,
  eventId: string,
  evidence: {
    time_recorded: string;
    description: string;
    evidence_type: string;
  }
) => {
  const response = await apiCall(
    `/events/${eventId}/evidence`,
    {
      method: 'POST',
      body: JSON.stringify(evidence),
    },
    orgId
  );
  return response.data;
};
```

### 获取产品列表

```typescript
const fetchProducts = async (orgId: string) => {
  const response = await apiCall('/management/products', {}, orgId);
  return response.data.items;
};
```

### 创建订阅

```typescript
const createSubscription = async (
  orgId: string,
  subscription: {
    subscription_type: string;
    filter_value: string;
    notify_channel: string;
  }
) => {
  const response = await apiCall(
    '/management/subscriptions',
    {
      method: 'POST',
      body: JSON.stringify(subscription),
    },
    orgId
  );
  return response.data;
};
```

## 4. 数据映射参考

### 前端类型 → API 返回映射

```typescript
// Frontend types (from src/types.ts)
interface Metric {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: string;
}

// API Response -> Frontend conversion
const apiMetricsToFrontend = (apiMetrics: any): Metric => {
  return {
    label: '事件总量 (30天)',
    value: apiMetrics.total_events_30d,
    change: '+12.4%',
    trend: 'up',
    icon: 'Activity',
  };
};
```

## 5. 错误处理

```typescript
try {
  const data = await apiCall('/events', {}, orgId);
  // 处理数据...
} catch (error) {
  if (error instanceof Error) {
    console.error('API Error:', error.message);
    // 显示错误提示给用户
  }
}
```

## 6. 本地开发启动

### 启动后台
```bash
cd server
npm install
npm run dev
```

### 启动前端
```bash
npm install
npm run dev
```

前端将在 `http://localhost:5173` 运行
后台将在 `http://localhost:3001` 运行

## 7. 生产部署

### 后台部署到云服务（如 Vercel, Railway, Heroku）

1. 设置环境变量
2. 部署后获得生产 URL（如 `https://api.example.com`）
3. 更新前端的 `VITE_API_URL`

### 前端部署

```bash
npm run build
# 部署 dist/ 目录到静态托管服务
```

## 8. 调试技巧

### 记录 API 请求

```typescript
// 在 apiCall 中添加日志
console.log(`[API] ${options.method || 'GET'} ${url}`);
```

### 使用浏览器开发者工具

- 打开 DevTools → Network tab
- 查看所有 API 请求和响应
- 检查 Request/Response headers

### 使用 Postman 或类似工具

- 导入 API 文档
- 在 Postman 中测试 API 端点
- 验证响应格式

## 9. 性能优化

### 缓存策略

```typescript
const cache = new Map();

async function apiCallWithCache<T>(
  endpoint: string,
  cacheKey: string,
  options: RequestInit = {},
  orgId?: string
): Promise<T> {
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const data = await apiCall<T>(endpoint, options, orgId);
  cache.set(cacheKey, data);
  
  // 5分钟后清除缓存
  setTimeout(() => cache.delete(cacheKey), 5 * 60 * 1000);
  
  return data;
}
```

### 批量请求

```typescript
// 并行请求多个端点
const [dashboard, alerts, events] = await Promise.all([
  apiCall('/dashboard', {}, orgId),
  apiCall('/alerts', {}, orgId),
  apiCall('/events', {}, orgId),
]);
```

## 下一步

1. 将 API 集成到所有前端组件
2. 实现 JWT 认证（替代 Mock 认证）
3. 添加实时通知（WebSocket/Server-Sent Events）
4. 性能监控和日志记录
