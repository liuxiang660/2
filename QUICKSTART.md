# 🚀 5分钟快速开始指南

## 前置条件

✅ Node.js 16+ 已安装  
✅ Supabase 账户已创建  
✅ 已克隆项目

## 步骤 1：配置 Supabase (2分钟)

### 1.1 创建 Supabase 项目
- 访问 https://supabase.com
- 点击"New Project"
- 填写项目信息并创建

### 1.2 获取凭证
在项目设置中复制：
- `Project URL`（形如：https://xxx.supabase.co）
- `anon public key`
- `service_role key`

### 1.3 초始化数据库
1. 打开 SQL 编辑器
2. 新建查询，粘贴 `server/db/schema.sql` 全部内容
3. 点击执行

## 步骤 2：配置后台 (1分钟)

```bash
cd server
cp .env.example .env.local
```

编辑 `.env.local`，替换：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

## 步骤 3：启动后台 (1分钟)

```bash
cd server
npm install
npm run dev
```

✓ 看到 "✓ Server running on http://localhost:3001"

## 步骤 4：启动前端 (1分钟)

新开终端：
```bash
cd ..
npm install
npm run dev
```

✓ 看到 "VITE v... ready in ... ms"

## 完成！ 🎉

访问 http://localhost:5173

- 查看仪表板：`http://localhost:5173/dashboard`
- 查看事件库：`http://localhost:5173/events`
- 查看风险地图：`http://localhost:5173/map`

---

## 🐛 故障排除

### 后台无法连接到 Supabase

**错误信息**：`Invalid API key`

**解决**：
- 检查 `.env.local` 中的 URL 和 KEY
- 确保复制无空格

### 前端无法调用 API

**错误信息**：`CORS error` 或 `Failed to fetch`

**解决**：
- 确保后台服务器运行中（http://localhost:3001/health）
- 检查 `.env.local` 中的 `VITE_API_URL=http://localhost:3001/api`

### 数据库表不存在

**错误信息**：`table does not exist`

**解决**：
- 在 Supabase SQL 编辑器中重新运行 `server/db/schema.sql`

---

## 📚 获取帮助

- [完整部署指南](BACKEND_SETUP.md)
- [后台 API 文档](server/README.md)
- [前后端集成指南](server/INTEGRATION_GUIDE.md)
- [数据库架构](server/db/schema.sql)

---

## 下一步

1. 在前端代码中集成 API 调用
2. 添加 JWT 认证
3. 部署到云服务
4. 配置监控和日志

祝你使用愉快！🚀
