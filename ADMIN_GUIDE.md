# 管理员界面使用指南

## 概述

Sentry Intelligence 数据字典管理系统现在拥有独立的管理员界面，用于管理数据库、用户权限和系统配置。

## 系统架构

### 认证系统

- **基于 JWT 的令牌认证**
  - 用户名/密码登录
  - 24小时令牌有效期
  - 令牌存储在浏览器本地存储中

- **权限级别系统**
  1. **VIEWER（查看员，等级1）**
     - 只能查看数据字典
     - 无修改权限

  2. **EDITOR（编辑员，等级2）**
     - 可以创建、修改、删除数据字典项
     - 可以导入/导出数据
     - 无用户管理权限

  3. **ADMIN（管理员，等级3）**
     - 拥有所有权限
     - 可以管理用户和权限
     - 可以删除数据字典项
     - 可以批量操作

### 数据库表结构

#### 用户相关表

**用户账户表 (user_account)**
```sql
- id: 主键
- username: 用户名（唯一）
- password_hash: 密码哈希
- email: 邮箱
- full_name: 全名
- is_active: 是否激活（1=激活，0=禁用）
- last_login: 最后登录时间
- login_count: 登录次数
- create_time: 创建时间
- update_time: 更新时间
```

**权限字典表 (permission_dict)**
```sql
- id: 主键
- permission_code: 权限代码（ADMIN, EDITOR, VIEWER）
- permission_name: 权限名称
- permission_level: 权限等级 (1-3)
- description: 描述
```

**用户权限关系表 (user_permission_relation)**
```sql
- id: 主键
- user_id: 用户ID
- permission_id: 权限ID
- grant_time: 分配时间
- granted_by: 分配者ID
```

### 支持的数据字典表

1. **产品分类** (product_tier1/2/3)
2. **企业行业分类** (enterprise_industry_tier1)
3. **风险分类** (risk_tier1/2)
4. **自然灾害分类** (natural_disaster_tier1/2)
5. **供应链流程** (supplychain_tier1/2)
6. **媒体相关** (media_tier, media_role, ...)
7. **地理数据** (country, transport_type)

## 功能模块

所有文件都已创建在以下位置：

### 前端文件

- **[src/utils/authService.ts](src/utils/authService.ts)** - 认证服务
- **[src/views/Login.tsx](src/views/Login.tsx)** - 登录界面
- **[src/views/AdminDictionaries.tsx](src/views/AdminDictionaries.tsx)** - 数据字典管理
- **[src/views/AdminUsers.tsx](src/views/AdminUsers.tsx)** - 用户管理
- **Updated [src/components/Layout.tsx](src/components/Layout.tsx)** - 添加管理员菜单
- **Updated [src/App.tsx](src/App.tsx)** - 添加认证和路由
- **Updated [src/types.ts](src/types.ts)** - 添加认证类型

### 后端文件

- **[server/src/utils/password.ts](server/src/utils/password.ts)** - 密码哈希和JWT工具
- **[server/src/controllers/authController.ts](server/src/controllers/authController.ts)** - 认证控制器
- **[server/src/middleware/auth.ts](server/src/middleware/auth.ts)** - 认证中间件
- **[server/src/routes/auth.ts](server/src/routes/auth.ts)** - 认证路由
- **[server/src/controllers/adminDictController.ts](server/src/controllers/adminDictController.ts)** - 字典管理控制器
- **[server/src/routes/adminDictionaries.ts](server/src/routes/adminDictionaries.ts)** - 字典管理路由
- **Updated [server/src/index.ts](server/src/index.ts)** - 注册新路由
- **Updated [server/db/schema.sql](server/db/schema.sql)** - 添加用户和权限表

### 数据库更新

- **Updated [server/db/schema.sql](server/db/schema.sql)**
  - 添加3个新表（user_account, permission_dict, user_permission_relation）
  - 添加相关索引
  - 插入初始数据（默认管理员账户）

## API 端点

### 认证 API

```
POST   /api/auth/login                    - 用户登录
POST   /api/auth/verify                   - 验证令牌
POST   /api/auth/register                 - 注册新用户（仅管理员）
GET    /api/auth/users                    - 获取所有用户（仅管理员）
PUT    /api/auth/users/:userId/permissions - 更新用户权限（仅管理员）
PATCH  /api/auth/users/:userId/status     - 启用/禁用用户（仅管理员）
```

### 数据字典管理 API

```
GET    /api/admin/dictionaries/:dictType           - 获取字典数据
POST   /api/admin/dictionaries/:dictType           - 创建新项
PUT    /api/admin/dictionaries/:dictType/:id       - 更新项
DELETE /api/admin/dictionaries/:dictType/:id       - 删除项（仅管理员）
POST   /api/admin/dictionaries/:dictType/import    - 批量导入（仅管理员）
GET    /api/admin/dictionaries/:dictType/export    - 导出数据
```

## 默认管理员账户

```
用户名: admin
密码: admin123
```

**注意**: 首次部署后，请立即修改默认密码！在数据库中更新user_account表的管理员密码。

## 工作流程

### 1. 首次登录

1. 访问应用
2. 在登录页面输入默认管理员账户
3. 登录成功后进入工作台

### 2. 创建新用户

1. 登录为管理员
2. 进入 "用户管理" 页面
3. 点击 "新建用户" 按钮
4. 填写用户信息和初始权限
5. 保存

### 3. 更新权限

1. 在用户列表中找到需要更新的用户
2. 点击 "设置" 按钮
3. 选择新的权限级别
4. 保存

### 4. 管理数据字典

1. 进入 "数据字典" 页面（或 "字典管理" 页面）
2. 选择要管理的字典类型
3. 执行 CRUD 操作
4. 搜索和分页浏览数据
5. 导入/导出数据

## 安全建议

1. **密码策略**
   - 修改默认管理员密码
   - 定期更新密码
   - 使用强密码（至少8字符，包含大小写和数字）

2. **访问控制**
   - 定期审核用户权限
   - 立即禁用离职员工账户
   - 为不同工作职能分配相应权限

3. **备份**
   - 定期备份数据库
   - 备份用户数据和权限设置
   - 保存导出的数据字典

4. **令牌管理**
   - JWT 令牌有效期为 24 小时
   - 用户登出时清除本地令牌
   - 支持修改密码后自动登出其他会话

## 故障排除

### 问题1: 无法登录

**症状**: 登录页面提示"用户名或密码错误"

**解决**:
1. 检查用户名是否正确（区分大小写）
2. 重置密码：
   ```sql
   -- 在数据库中执行以下命令重置 admin 密码为 admin123
   -- 密码哈希值是预生成的 $pbkdf2$ 格式
   ```
3. 检查用户是否被禁用（is_active = 0）

### 问题2: 没有权限执行操作

**症状**: 执行操作时显示权限不足

**解决**:
1. 联系管理员请求权限升级
2. 检查当前用户的权限等级
3. 确认你的账户已被分配必要的权限

### 问题3: 数据字典加载缓慢

**症状**: 数据字典页面加载时间过长

**解决**:
1. 检查网络连接
2. 检查后端服务是否运行
3. 检查数据库是否有大量数据
4. 使用搜索和分页减少数据加载

## 性能优化

1. **分页加载**
   - 数据字典默认每页显示20条记录
   - 大数据集自动分页

2. **索引优化**
   - 用户查询索引: username, email
   - 权限查询索引: permission_level
   - 字典查询索引: 各表的id字段

3. **缓存策略**
   - 용户信息缓存在客户端
   - 令牌在本地存储中
   - 刷新时重新验证

## 扩展功能建议

1. **审计日志**
   - 记录所有管理员操作
   - 添加操作历史追踪

2. **角色管理**
   - 创建自定义角色
   - 为角色分配权限

3. **数据验证**
   - 字段级别的数据验证规则
   - 批量导入前的数据预检

4. **通知系统**
   - 用户权限变更通知
   - 系统事件通知

## 联系方式

对于功能要求或 bug 报告，请通过以下方式联系开发团队：
- 📧 Email: admin@sentry-intelligence.local
- 💬 反馈: 应用中的 "意见反馈" 菜单

---

**最后更新**: 2024年3月23日
**版本**: 1.0.0
