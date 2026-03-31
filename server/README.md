# 供应链风险智能平台 - 后台 API 文档

## 概述

这是 Sentry Intelligence（供应链风险全景地图平台）的 Node.js + Express + TypeScript 后台，集成 Supabase PostgreSQL 数据库。

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填入 Supabase 凭证：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 3. 配置 Supabase 数据库

在 Supabase SQL 编辑器中运行 `db/schema.sql` 中的 SQL 脚本来创建数据库表：

1. 打开 [Supabase](https://app.supabase.com) 控制台
2. 进入你的项目
3. 选择 SQL 编辑器
4. 新建查询，复制并粘贴 `db/schema.sql` 中所有 SQL 代码
5. 执行脚本

### 4. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3001` 启动。

## API 端点概览

### 基础 URL
```
http://localhost:3001/api
```

### 仪表板端点
```
GET  /dashboard              - 获取完整仪表板数据
GET  /dashboard/metrics      - 获取指标数据
GET  /dashboard/risk-index   - 获取风险指数
```

### 事件端点
```
GET    /events               - 获取事件列表（支持分页、过滤）
POST   /events               - 创建新事件
GET    /events/:id           - 获取事件详情
PUT    /events/:id           - 更新事件
DELETE /events/:id           - 删除事件（软删除）
POST   /events/:id/evidence  - 添加证据链项
```

### 预警端点
```
GET    /alerts               - 获取预警列表
POST   /alerts               - 创建预警
PUT    /alerts/:id/read      - 标记预警为已读
DELETE /alerts/:id           - 删除预警
```

### 管理端点
```
GET    /management/products           - 获取产品列表
POST   /management/products           - 创建产品
PUT    /management/products/:id       - 更新产品
DELETE /management/products/:id       - 删除产品

GET    /management/product-portrait            - 获取产品画像配置与版本
PUT    /management/product-portrait/config     - 保存产品画像配置
PUT    /management/product-portrait/rows       - 保存产品画像明细并生成版本
POST   /management/product-portrait/rollback   - 回滚画像版本

GET    /management/subscriptions      - 获取用户订阅
POST   /management/subscriptions      - 创建订阅
DELETE /management/subscriptions/:id  - 删除订阅
```

## 详细 API 文档

### 1. 获取仪表板数据

```http
GET /api/dashboard?time_range=7days
X-Organization-ID: your-org-id
```

**参数：**
- `time_range`: `7days` | `30days` | `90days` (可选，默认 7days)

**响应：**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "total_events_7d": 150,
      "total_events_30d": 450,
      "high_risk_events": 15,
      "coverage_rate": 98.2,
      "active_subscriptions": 348
    },
    "alerts": [...],
    "trends": [...],
    "risk_distribution": [...],
    "global_risk_index": 68.5,
    "critical_regions": ["Hamburg", "Shanghai", ...]
  }
}
```

### 2. 获取事件列表

```http
GET /api/events?page=1&per_page=20&severity=critical&date_from=2024-01-01
X-Organization-ID: your-org-id
```

**参数：**
- `page`: 页码 (可选，默认 1)
- `per_page`: 每页数量 (可选，默认 20，最大 100)
- `severity`: `critical` | `warning` | `info` | `all` (可选)
- `event_type_id`: 事件类型 ID (可选)
- `date_from`: 开始日期 (可选)
- `date_to`: 结束日期 (可选)
- `sort_by`: `created_at` | `occurred_at` | `confidence_score` | `severity` (可选)
- `sort_order`: `asc` | `desc` (可选)

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "evt-123",
        "title": "Port Strike: Hamburg",
        "severity": "critical",
        "confidence_score": 98,
        "occurred_at": "2024-01-15T08:42:00Z",
        "locations": [...],
        "sources": [...],
        "evidence_chain": [...]
      }
    ],
    "total": 150,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  }
}
```

### 3. 创建事件

```http
POST /api/events
X-Organization-ID: your-org-id
Content-Type: application/json

{
  "title": "Port Strike: Hamburg",
  "description": "Worker strike causes delays",
  "event_type_id": "type-123",
  "severity": "critical",
  "confidence_score": 98,
  "occurred_at": "2024-01-15T08:42:00Z",
  "locations": [
    {
      "location_name": "Hamburg, Germany",
      "country_code": "DE",
      "latitude": 53.5,
      "longitude": 10.0,
      "supply_chain_node": "port"
    }
  ],
  "sources": [
    {
      "source_type": "news",
      "source_name": "Reuters",
      "source_url": "https://example.com",
      "credibility_score": 95
    }
  ]
}
```

### 4. 获取事件详情

```http
GET /api/events/evt-123
X-Organization-ID: your-org-id
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "evt-123",
    "title": "Port Strike: Hamburg",
    "description": "...",
    "severity": "critical",
    "confidence_score": 98,
    "occurred_at": "2024-01-15T08:42:00Z",
    "locations": [...],
    "sources": [...],
    "evidence_chain": [
      {
        "id": "ev-1",
        "time_recorded": "2024-01-15T08:42:00Z",
        "description": "Strike officially begins",
        "evidence_type": "source",
        "source": "Reuters",
        "sequence_order": 1
      }
    ],
    "impacts": [...]
  }
}
```

### 5. 添加证据链

```http
POST /api/events/evt-123/evidence
X-Organization-ID: your-org-id
Content-Type: application/json

{
  "time_recorded": "2024-01-15T09:30:00Z",
  "description": "Cranes stopped at CTA terminal",
  "evidence_type": "observation",
  "source": "social_media",
  "supporting_url": "https://example.com",
  "sequence_order": 2
}
```

### 6. 获取预警列表

```http
GET /api/alerts?is_read=false&severity=critical
X-Organization-ID: your-org-id
```

**参数：**
- `page`: 页码 (可选)
- `per_page`: 每页数量 (可选)
- `is_read`: true | false (可选)
- `severity`: `critical` | `warning` | `info` | `all` (可选)

### 7. 创建预警

```http
POST /api/alerts
X-Organization-ID: your-org-id
Content-Type: application/json

{
  "title": "New Critical Event",
  "description": "Hamburg port strike alert",
  "severity": "critical",
  "alert_type": "new_event",
  "event_id": "evt-123"
}
```

### 8. 标记预警为已读

```http
PUT /api/alerts/alert-123/read
X-Organization-ID: your-org-id
```

### 9. 获取产品列表

```http
GET /api/management/products?page=1&per_page=20
X-Organization-ID: your-org-id
```

### 10. 创建产品

```http
POST /api/management/products
X-Organization-ID: your-org-id
Content-Type: application/json

{
  "name": "Laptop Processors",
  "hs_code": "8542.31",
  "gpc_code": "12345678",
  "category": "Electronics",
  "description": "High-end laptop processors",
  "supply_chain_stage": "manufacturing"
}
```

### 11. 获取订阅

```http
GET /api/management/subscriptions
X-Organization-ID: your-org-id
X-User-ID: user-123
```

### 12. 创建订阅

```http
POST /api/management/subscriptions
X-Organization-ID: your-org-id
X-User-ID: user-123
Content-Type: application/json

{
  "subscription_type": "location",
  "filter_value": "Hamburg",
  "notify_channel": "email"
}
```

## 数据库架构

### 核心表

1. **users** - 用户信息
2. **organizations** - 组织/租户
3. **products** - 产品画像
4. **events** - 核心事件表
5. **event_locations** - 事件地点
6. **event_sources** - 事件来源
7. **evidence_chain** - 证据链
8. **event_impacts** - 事件影响
9. **alerts** - 实时预警
10. **subscriptions** - 用户订阅
11. **dashboard_metrics** - 仪表板指标
12. **risk_assessments** - 风险评估

详见 `db/schema.sql`

## 项目结构

```
server/
├── src/
│   ├── index.ts                 # 主服务器文件
│   ├── types.ts                 # TypeScript 类型定义
│   ├── controllers/             # 业务逻辑控制器
│   │   ├── eventController.ts
│   │   ├── alertController.ts
│   │   ├── dashboardController.ts
│   │   └── productController.ts
│   ├── routes/                  # API 路由
│   │   ├── events.ts
│   │   ├── alerts.ts
│   │   ├── dashboard.ts
│   │   └── management.ts
│   ├── middleware/              # 中间件
│   │   └── index.ts
│   └── utils/                   # 工具函数
│       └── db.ts                # Supabase 连接
├── db/
│   ├── schema.sql               # 数据库架构脚本
│   └── README.md
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 开发指南

### 添加新的 API 端点

1. 在 `src/controllers/` 中创建新的控制器文件
2. 在 `src/routes/` 中创建新的路由文件
3. 在 `src/index.ts` 中注册路由

### 端点示例：

**controllers/userController.ts**
```typescript
export const userController = {
  async getUsers(req: AuthRequest, res: Response) {
    // 实现逻辑
  }
}
```

**routes/users.ts**
```typescript
import { Router } from 'express';
import { userController } from '../controllers/userController';

const router = Router();
router.get('/', (req, res) => userController.getUsers(req as any, res));

export default router;
```

**src/index.ts**
```typescript
import userRoutes from './routes/users';
app.use(`${apiPrefix}/users`, userRoutes);
```

## 认证

目前使用 Mock 认证。在生产环境中，应实现 JWT 认证：

```typescript
// 在 index.ts 中添加
import jwt from 'jsonwebtoken';

app.use((req: any, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});
```

## 错误处理

所有 API 响应遵循统一格式：

```json
{
  "success": true|false,
  "data": {...},
  "error": "error message"
}
```

## 构建和部署

### 构建
```bash
npm run build
```

### 启动生产服务器
```bash
npm run start
```

## 相关文档

- [Supabase 文档](https://supabase.com/docs)
- [Express 文档](https://expressjs.com/)
- [TypeScript 文档](https://www.typescriptlang.org/)

## 常见问题

### Q: 如何修改 API 端口？
A: 修改 `.env` 文件中的 `PORT` 变量，或运行时传入 `PORT=8000 npm run dev`

### Q: 如何连接到不同的 Supabase 项目？
A: 在 `.env` 中修改 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`

### Q: 如何启用 CORS？
A: 修改 `.env` 中的 `CORS_ORIGIN` 或在 `src/middleware/index.ts` 中修改 CORS 配置

## 支持

如有问题，请提交 Issue 或联系开发团队。
