# 供应链风险全景地图平台 - 完整部署指南

## 📋 项目概述

这是一个供应链风险全景地图平台，用于实时监测全球智能动态及供应链风险因子。

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS
- **后台**：Express + TypeScript + Supabase PostgreSQL
- **数据库**：Supabase (PostgreSQL)

## 🚀 快速开始

### 系统要求

- Node.js 16+ 
- npm/yarn
- Supabase 账户

### 1. 克隆项目

```bash
git clone <repo-url>
cd sentry-intelligence
```

### 2. 配置 Supabase

#### 创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com)
2. 创建新项目
3. 获取项目 URL 和 API 密钥

#### 初始化数据库

1. 在 Supabase 控制台打开 SQL 编辑器
2. 新建查询
3. 复制 `server/db/schema.sql` 中所有内容
4. 执行 SQL 脚本

### 3. 配置后台环境

```bash
cd server
cp .env.example .env.local
```

编辑 `server/.env.local`：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 4. 配置前端环境

在项目根目录创建 `.env.local`：

```env
VITE_API_URL=http://localhost:3001/api
VITE_ORG_ID=demo-org-id
```

### 5. 启动开发环境

#### 方式 1：分别启动（推荐）

**终端 1 - 启动后台：**
```bash
cd server
npm install
npm run dev
```

**终端 2 - 启动前端：**
```bash
npm install
npm run dev
```

#### 方式 2：一键启动（Linux/Mac）

```bash
chmod +x start-dev.sh
./start-dev.sh
```

#### 方式 3：一键启动（Windows）

双击 `start-dev.bat`，然后在另一个终端启动前端

---

## 📱 访问应用

- **前端应用**：http://localhost:5173 (或显示的 Vite 端口)
- **后台 API**：http://localhost:3001/api
- **API 文档**：http://localhost:3001/api
- **健康检查**：http://localhost:3001/health

---

## 📦 项目结构

```
sentry-intelligence/
├── src/                          # 前端源代码
│   ├── components/              # React 组件
│   ├── views/                   # 页面视图
│   │   ├── Dashboard.tsx        # 仪表板
│   │   ├── RiskMap.tsx          # 风险地图
│   │   ├── EventLibrary.tsx     # 事件库
│   │   ├── EventDetail.tsx      # 事件详情
│   │   ├── SupplyChainView.tsx  # 供应链视图
│   │   └── Management.tsx       # 管理配置
│   ├── types.ts                 # 类型定义
│   ├── utils.ts                 # 工具函数
│   └── App.tsx                  # 主应用
│
├── server/                       # 后台源代码
│   ├── src/
│   │   ├── index.ts             # Express 服务器入口
│   │   ├── types.ts             # 类型定义
│   │   ├── controllers/         # 业务逻辑
│   │   ├── routes/              # API 路由
│   │   ├── middleware/          # 中间件
│   │   └── utils/               # 工具函数
│   ├── db/
│   │   ├── schema.sql           # 数据库架构
│   │   └── README.md
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── README.md                # 后台详细文档
│   └── INTEGRATION_GUIDE.md     # 前后端集成指南
│
├── package.json                 # 前端依赖
├── tsconfig.json                # TypeScript 配置
├── vite.config.ts               # Vite 配置
├── tailwind.config.js           # Tailwind 配置
├── 数据库文档.md               # 数据库文档
├── PRD.md                       # 产品需求文档
├── README.md                    # 本文件
└── start-dev.sh/bat             # 启动脚本
```

---

## 🔌 API 端点概览

### 仪表板
```
GET  /api/dashboard                   - 获取完整仪表板数据
GET  /api/dashboard/metrics          - 获取指标
GET  /api/dashboard/risk-index        - 获取风险指数
```

### 事件
```
GET    /api/events                    - 获取事件列表
POST   /api/events                    - 创建事件
GET    /api/events/:id                - 获取事件详情
PUT    /api/events/:id                - 更新事件
DELETE /api/events/:id                - 删除事件
POST   /api/events/:id/evidence       - 添加证据链
```

### 预警
```
GET    /api/alerts                    - 获取预警列表
POST   /api/alerts                    - 创建预警
PUT    /api/alerts/:id/read           - 标记为已读
DELETE /api/alerts/:id                - 删除预警
```

### 管理
```
GET    /api/management/products       - 产品列表
POST   /api/management/products       - 创建产品
PUT    /api/management/products/:id   - 更新产品
DELETE /api/management/products/:id   - 删除产品

GET    /api/management/subscriptions  - 订阅列表
POST   /api/management/subscriptions  - 创建订阅
DELETE /api/management/subscriptions/:id - 删除订阅
```

详见 [后台 API 文档](server/README.md)

---

## 🗄️ 数据库架构

主要表结构：

- **users**: 用户信息
- **organizations**: 组织/租户
- **products**: 产品画像
- **events**: 核心事件（标题、描述、风险等级、置信度）
- **event_locations**: 事件地点（地理位置、供应链节点）
- **event_sources**: 事件来源（新闻、官方、社媒等）
- **evidence_chain**: 证据链（时间轴上的证据项）
- **event_impacts**: 事件影响（对产品的影响）
- **alerts**: 实时预警
- **subscriptions**: 用户订阅规则
- **dashboard_metrics**: 仪表板指标
- **risk_assessments**: 风险评估

详见 [数据库架构](server/db/schema.sql)

---

## 🔐 认证与授权

### 当前实现
使用 Mock 认证（用于开发）

### 生产环境建议
实现 JWT Bearer Token 认证：

```typescript
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: <ORG_ID>
```

详见 [后台文档](server/README.md#认证)

---

## 📝 前后端集成

### 在前端中调用 API

```typescript
const orgId = import.meta.env.VITE_ORG_ID;

// 获取事件
const response = await fetch(
  'http://localhost:3001/api/events?page=1&per_page=20',
  {
    headers: {
      'X-Organization-ID': orgId,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
```

详见 [集成指南](server/INTEGRATION_GUIDE.md)

---

## 🛠️ 常用命令

### 后台

```bash
cd server

# 开发
npm run dev

# 构建
npm run build

# 启动生产版
npm start

# 类型检查
npm run lint

# 运行数据库迁移
npm run db:migration
```

### 前端

```bash
# 开发
npm run dev

# 构建
npm run build

# 预览构建结果
npm run preview

# 类型检查
npm run lint

# 清理构建缓存
npm run clean
```

---

## 🚢 部署

### 后台部署（Vercel/Railway/Heroku）

1. 设置环境变量
2. 部署源代码
3. 获得部署 URL（如 `https://api.example.com`）

### 前端部署（Vercel/Netlify/Static Hosting）

1. 修改 `VITE_API_URL`：
```env
VITE_API_URL=https://api.example.com
```

2. 构建：
```bash
npm run build
```

3. 部署 `dist/` 目录

---

## 🐛 调试

### 查看后台日志
```bash
cd server
npm run dev
```

### 使用 Chrome DevTools
- F12 打开开发者工具
- Network 标签查看 API 请求
- Console 查看错误日志

### 使用 Postman 测试 API
- 创建新的 Request
- 设置请求头：`X-Organization-ID: demo-org-id`
- 测试各个端点

---

## 📚 文档

- [后台详细文档](server/README.md)
- [前后端集成指南](server/INTEGRATION_GUIDE.md)
- [数据库架构](server/db/schema.sql)
- [产品需求文档](PRD.md)
- [数据库文档](数据库文档.md)

---

## 🎯 核心功能

✅ **工作台总览**（Dashboard）
- 实时指标卡
- 趋势图表
- 预警通知
- 风险分布

✅ **风险全景地图**（Risk Map）
- GIS 可视化
- 地点标记
- 风险热区
- 时间轴

✅ **事件库**（Event Library）
- 事件列表和搜索
- 多维度过滤
- 批量操作
- 数据导出

✅ **事件详情**（Event Detail）
- 完整事件信息
- 证据链追踪
- 来源验证
- 关联关系

✅ **供应链视图**（Supply Chain View）
- 产品画像
- 供应链映射
- 关联分析

✅ **配置管理**（Management）
- 用户权限
- 产品维护
- 订阅规则
- 系统设置

---

## 📞 支持

遇到问题？

1. 检查 [后台文档](server/README.md)
2. 查看 [集成指南](server/INTEGRATION_GUIDE.md)
3. 检查环境变量配置
4. 查看后台和前端日志
5. 提交 Issue

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)

---

## 🎉 快速检查清单

完成部署前，请确保：

- [ ] Supabase 项目已创建并配置
- [ ] 后台 `.env.local` 已正确配置
- [ ] 前端 `.env.local` 已正确配置
- [ ] 数据库 SQL 脚本已执行
- [ ] 后台服务器正在运行（http://localhost:3001/health）
- [ ] 前端应用正在运行（http://localhost:5173）
- [ ] 可以成功获取 Dashboard 数据
- [ ] CORS 已正确配置

---

最后更新：2024年
