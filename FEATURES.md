# 新增功能：数据字典管理系统

## 功能简介

已成功集成数据字典管理系统，包括**后端API**、**数据库**和**前端UI**三层完整实现。

## 新增数据库表（共52张表）

### 1. 产品编码系统
- `product_tier1_code_dict` - 产品一级分类
- `product_tier2_code_dict` - 产品二级分类  
- `product_tier3_code_dict` - 产品三级分类
- `industry_chain_node_dict` - 产业链节点
- `industry_chain_node_relation` - 产业链上下游关系
- `attribute_dict` - 产品属性定义
- `attribute_value_dict` - 产品属性值
- `industry_chain_node_attribute_relation_dict` - 产品属性关联

### 2. 企业实体系统
- `enterprise_industry_tier1_dict` - 企业一级行业分类
- `enterprise_industry_tier2_dict` - 企业二级行业分类
- `enterprise_industry_tier3_dict` - 企业三级行业分类
- `enterprise_industry_tier4_dict` - 企业四级行业分类
- `enterprise_dict` - 企业主表

### 3. 供应链流程系统
- `supplychain_tier1_dict` - 供应链一级流程
- `supplychain_tier2_dict` - 供应链二级流程

### 4. 数据来源系统（14个表）
- `media_tier_code_dict` - 来源分层
- `media_role_code_dict` - 来源角色
- `media_coverage_code_dict` - 覆盖范围
- `media_channel_code_dict` - 渠道
- `media_ownership_code_dict` - 组织属性
- `media_data_source_dict` - 数据来源主表
- `media_access_l1_code_dict` - 访问授权一级
- `media_access_l2_code_dict` - 访问授权二级
- `media_data_source_access` - 数据源访问配置
- `media_domain_focus_l1_code_dict` - 内容定位一级
- `media_domain_focus_l2_code_dict` - 内容定位二级
- `media_text_content_type_code_dict` - 文本内容类型
- `media_factuality_code_dict` - 事实性等级
- `media_polarity_code_dict` - 情绪极性
- `media_emotion_code_dict` - 情绪类别
- `media_text_category_dict` - 文本分类

### 5. 地理位置系统
- `un_region_dict` - 联合国大区
- `un_subregion_dict` - 联合国次区域
- `country_code_dict` - 国家编码
- `locode_point_dict` - UN/LOCODE点位
- `transport_type_dict` - 运输方式
- `transport_route_dict` - 运输线路
- `country_transport_route_dict` - 国家级运输线路

### 6. 风险字典系统
- `risk_tier1_type_dict` - 一级风险类型
- `risk_tier2_type_dict` - 二级风险类型
- `natural_disaster_tier1_dict` - 自然灾害灾类
- `natural_disaster_tier2_dict` - 自然灾害灾种

### 7. 业务数据表
- `event_main` - 事件主表

### 8. 关联表（多对多）
- `event_risk_relation` - 事件-风险关联
- `event_product_relation` - 事件-产品关联
- `event_enterprise_relation` - 事件-企业关联
- `event_geo_relation` - 事件-地理关联

## 后端API端点

### 字典表API路由：`/api/dictionaries`

#### 1. 获取所有字典数据
```bash
GET /api/dictionaries/all
```
返回所有字典表的完整数据

#### 2. 获取产品分类树
```bash
GET /api/dictionaries/product-classification
```
返回三级产品分类的树形结构

#### 3. 获取风险分类树
```bash
GET /api/dictionaries/risk-classification
```
返回一级和二级风险分类的树形结构

#### 4. 获取供应链流程
```bash
GET /api/dictionaries/supplychain-process
```
返回供应链的分级流程定义

#### 5. 获取媒体数据源
```bash
GET /api/dictionaries/media-sources
```
返回所有媒体数据源的配置信息

#### 6. 获取地理信息
```bash
GET /api/dictionaries/geographic-data
```
返回大区、次区域、国家等地理数据

#### 7. 获取自然灾害分类
```bash
GET /api/dictionaries/disaster-classification
```
返回灾类和灾种的树形结构

## 前端新增功能

### 1. 导航菜单
在主导航栏新增"数据字典"菜单项（Database图标）

### 2. 数据字典管理页面
完整的字典表展示界面，包含：

#### 标签页功能
- **产品分类** - 展示HS编码的三级分类体系
- **风险分类** - 展示一级和二级风险类型
- **自然灾害** - 展示灾类和灾种
- **供应链流程** - 展示流程体系
- **地理大区** - 展示UN地理大区
- **国家** - 展示ISO国家编码
- **运输方式** - 展示运输方式列表
- **媒体来源** - 展示媒体数据源配置

#### 交互功能
- 树形结构展开/折叠
- 表格数据展示
- 分类统计指标卡

## 示例数据

系统自动插入的示例数据包括：

### 产品分类示例
- 一级：01-动物产品、02-植物产品、03-动物油脂、04-食品饮料、05-矿产品
- 二级：0101-活马驴等
- 三级：010100-纯种繁殖马

### 风险分类示例
- 一级：劳资纠纷、自然灾害、供应短缺、网络安全、地缘政治
- 二级：港口罢工（等级4）、台风预警（等级5）

### 供应链流程示例
- SC01-生产制造 → SC02-港口码头 → SC03-仓储配送 → SC04-末端派送

### 地理数据示例
- 大区：非洲、亚洲、欧洲、美洲、大洋洲
- 国家：中国(CN)、新加坡(SG)
- 运输方式：海运、空运、陆运、铁路运输

### 媒体来源示例
- 分层：主流媒体、专业媒体、社交媒体、官方渠道
- 角色：一手信息源、二手转发、分析评论
- 覆盖范围：全球、区域、国家、本地

## 使用流程

### 1. 部署数据库Schema
```sql
-- 在 Supabase SQL 编辑器执行
-- 复制 server/db/schema.sql 全部内容
```

### 2. 启动后端服务
```bash
cd server
npm install
npm run dev
# 服务运行在 http://localhost:3001
```

### 3. 启动前端应用
```bash
npm install
npm run dev
# 应用运行在 http://localhost:5173
```

### 4. 访问新功能
- 打开前端应用
- 在主导航栏点击"数据字典"
- 浏览各类字典表数据

## 技术设计

### 后端架构
```
dictController.ts (业务逻辑)
  ↓
dictionaries.ts (REST路由)
  ↓
supabase (PostgreSQL数据源)
```

### 前端架构
```
App.tsx (路由管理)
  ↓
Layout.tsx (导航菜单)
  ↓
DataDictionary.tsx (数据展示)
```

### 数据流
```
前端UI → API请求 → 后端Controller → Supabase查询 → 树形/表格渲染
```

## API使用示例

### JavaScript/TypeScript
```typescript
// 获取所有字典数据
const response = await fetch('/api/dictionaries/all');
const data = await response.json();

// 获取产品分类（树形结构）
const response = await fetch('/api/dictionaries/product-classification');
const products = await response.json();

// 获取具体分类下的子项
products.forEach(tier1 => {
  console.log(tier1.tier1_name);
  tier1.children.forEach(tier2 => {
    console.log(`  ${tier2.tier2_name}`);
    tier2.children.forEach(tier3 => {
      console.log(`    ${tier3.tier3_name}`);
    });
  });
});
```

## 后续扩展功能

1. **编辑功能** - 添加/编辑/删除字典项
2. **搜索功能** - 全文搜索字典数据
3. **导出功能** - 导出为Excel/CSV
4. **版本管理** - 字典项版本变更历史
5. **权限管理** - 按用户角色控制修改权限
6. **关联查询** - 显示相关的关联记录

## 故障排除

### 数据为空
- 确认 Supabase 中已执行 schema.sql 脚本
- 检查示例数据 INSERT 语句中的外键关联

### API 404 错误
- 确认后端已启动时服务正在 3001 端口运行
- 检查 `/api/dictionaries` 路由是否正确注册

### 前端导入错误
- 确认 `DataDictionary.tsx` 文件已创建
- 检查 `App.tsx` 中的导入路径

## 相关文件

- [数据库Schema](server/db/schema.sql)
- [后端Controller](server/src/controllers/dictController.ts)
- [后端路由](server/src/routes/dictionaries.ts)
- [前端组件](src/views/DataDictionary.tsx)
- [路由配置](src/types.ts)
