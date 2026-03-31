-- ================================
-- 供应链风险预警系统 - PostgreSQL Database Schema
-- Based on 数据库文档.md
-- ================================

-- ================================
-- 1. 产品编码字典表
-- ================================

-- 产品一级分类字典表
CREATE TABLE IF NOT EXISTS product_tier1_code_dict (
  id BIGSERIAL PRIMARY KEY,
  tier1_code VARCHAR(32) NOT NULL UNIQUE,
  tier1_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 产品二级分类字典表
CREATE TABLE IF NOT EXISTS product_tier2_code_dict (
  id BIGSERIAL PRIMARY KEY,
  tier2_code VARCHAR(32) NOT NULL UNIQUE,
  tier2_name VARCHAR(100) NOT NULL,
  tier1_id BIGINT NOT NULL,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tier1_id) REFERENCES product_tier1_code_dict(id)
);

-- 产品三级分类字典表
CREATE TABLE IF NOT EXISTS product_tier3_code_dict (
  id BIGSERIAL PRIMARY KEY,
  tier3_code VARCHAR(32) NOT NULL UNIQUE,
  tier3_name VARCHAR(100) NOT NULL,
  tier2_id BIGINT NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tier2_id) REFERENCES product_tier2_code_dict(id)
);

-- 产业链网络产品节点主表
CREATE TABLE IF NOT EXISTS industry_chain_node_dict (
  id BIGSERIAL PRIMARY KEY,
  node_code VARCHAR(32) NOT NULL UNIQUE,
  node_name VARCHAR(100) NOT NULL,
  tier3_id BIGINT NOT NULL,
  risk_level SMALLINT,
  delay_hours INT,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tier3_id) REFERENCES product_tier3_code_dict(id)
);

-- 兼容已建库场景：补充供应链节点风险字段
ALTER TABLE industry_chain_node_dict ADD COLUMN IF NOT EXISTS risk_level SMALLINT;
ALTER TABLE industry_chain_node_dict ADD COLUMN IF NOT EXISTS delay_hours INT;

-- 产业链上下游关系表
CREATE TABLE IF NOT EXISTS industry_chain_node_relation (
  id BIGSERIAL PRIMARY KEY,
  upstream_node_id BIGINT NOT NULL,
  downstream_node_id BIGINT NOT NULL,
  relation_type VARCHAR(32),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (upstream_node_id) REFERENCES industry_chain_node_dict(id),
  FOREIGN KEY (downstream_node_id) REFERENCES industry_chain_node_dict(id)
);

-- 产业链节点属性名称字典表
CREATE TABLE IF NOT EXISTS attribute_dict (
  id BIGSERIAL PRIMARY KEY,
  attribute_name VARCHAR(100) NOT NULL,
  attribute_source VARCHAR(32) NOT NULL,
  remark VARCHAR(255)
);

-- 产业链节点属性值字典表
CREATE TABLE IF NOT EXISTS attribute_value_dict (
  id BIGSERIAL PRIMARY KEY,
  attribute_id BIGINT NOT NULL,
  value_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  FOREIGN KEY (attribute_id) REFERENCES attribute_dict(id)
);

-- 产业链节点属性关联字典表
CREATE TABLE IF NOT EXISTS industry_chain_node_attribute_relation_dict (
  id BIGSERIAL PRIMARY KEY,
  node_id BIGINT NOT NULL,
  attribute_id BIGINT NOT NULL,
  value_id BIGINT NOT NULL,
  remark VARCHAR(255),
  FOREIGN KEY (node_id) REFERENCES industry_chain_node_dict(id),
  FOREIGN KEY (attribute_id) REFERENCES attribute_dict(id),
  FOREIGN KEY (value_id) REFERENCES attribute_value_dict(id)
);

-- ================================
-- 2. 企业实体编码字典表
-- ================================

-- 企业一级行业分类字典表
CREATE TABLE IF NOT EXISTS enterprise_industry_tier1_dict (
  id BIGSERIAL PRIMARY KEY,
  tier1_code VARCHAR(1) NOT NULL UNIQUE,
  tier1_name VARCHAR(80) NOT NULL,
  is_active CHAR(1) DEFAULT '1',
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255)
);

-- 企业二级行业分类字典表
CREATE TABLE IF NOT EXISTS enterprise_industry_tier2_dict (
  id BIGSERIAL PRIMARY KEY,
  tier2_code VARCHAR(2) NOT NULL UNIQUE,
  tier2_name VARCHAR(150) NOT NULL,
  tier1_id BIGINT,
  is_active CHAR(1) DEFAULT '1',
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255),
  FOREIGN KEY (tier1_id) REFERENCES enterprise_industry_tier1_dict(id)
);

-- 企业三级行业分类字典表
CREATE TABLE IF NOT EXISTS enterprise_industry_tier3_dict (
  id BIGSERIAL PRIMARY KEY,
  tier3_code VARCHAR(3) NOT NULL UNIQUE,
  tier3_name VARCHAR(150) NOT NULL,
  tier2_id BIGINT,
  is_active CHAR(1) DEFAULT '1',
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255),
  FOREIGN KEY (tier2_id) REFERENCES enterprise_industry_tier2_dict(id)
);

-- 企业四级行业分类字典表
CREATE TABLE IF NOT EXISTS enterprise_industry_tier4_dict (
  id BIGSERIAL PRIMARY KEY,
  tier4_code VARCHAR(4) NOT NULL UNIQUE,
  tier4_name VARCHAR(200) NOT NULL,
  tier3_id BIGINT,
  is_active CHAR(1) DEFAULT '1',
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255),
  FOREIGN KEY (tier3_id) REFERENCES enterprise_industry_tier3_dict(id)
);

-- 企业主表
CREATE TABLE IF NOT EXISTS enterprise_dict (
  id BIGSERIAL PRIMARY KEY,
  enterprise_code VARCHAR(20) NOT NULL UNIQUE,
  code_type SMALLINT NOT NULL,
  enterprise_name VARCHAR(200) NOT NULL,
  scale_code VARCHAR(2),
  control_type_code VARCHAR(2),
  register_date DATE NOT NULL,
  register_capital NUMERIC(18,2) NOT NULL,
  legal_representative VARCHAR(100),
  top_honor_level_code VARCHAR(100),
  top_honor_code VARCHAR(255),
  geo_code VARCHAR(12),
  is_listed SMALLINT DEFAULT 0,
  stock_exchange VARCHAR(50),
  stock_name VARCHAR(100),
  stock_code VARCHAR(20),
  tier1_id BIGINT,
  tier2_id BIGINT,
  tier3_id BIGINT,
  tier4_id BIGINT,
  created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255),
  FOREIGN KEY (tier1_id) REFERENCES enterprise_industry_tier1_dict(id),
  FOREIGN KEY (tier2_id) REFERENCES enterprise_industry_tier2_dict(id),
  FOREIGN KEY (tier3_id) REFERENCES enterprise_industry_tier3_dict(id),
  FOREIGN KEY (tier4_id) REFERENCES enterprise_industry_tier4_dict(id)
);

-- ================================
-- 3. 供应链流程编码字典表
-- ================================

-- 供应链一级流程字典表
CREATE TABLE IF NOT EXISTS supplychain_tier1_dict (
  id BIGSERIAL PRIMARY KEY,
  tier1_code VARCHAR(20) NOT NULL,
  tier1_name VARCHAR(50) NOT NULL,
  tier1_name_en VARCHAR(50) NOT NULL,
  sequence_no INT NOT NULL UNIQUE,
  standard_input VARCHAR(500),
  standard_output VARCHAR(500),
  status SMALLINT DEFAULT 1,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255)
);

-- 供应链二级流程字典表
CREATE TABLE IF NOT EXISTS supplychain_tier2_dict (
  id BIGSERIAL PRIMARY KEY,
  tier2_code VARCHAR(30),
  tier1_id BIGINT,
  tier2_name VARCHAR(100) NOT NULL,
  tier2_name_en VARCHAR(100),
  sequence_no INT NOT NULL UNIQUE,
  input_spec VARCHAR(500),
  output_spec VARCHAR(500),
  key_activities VARCHAR(500),
  trigger_condition VARCHAR(200),
  status SMALLINT DEFAULT 1,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255),
  FOREIGN KEY (tier1_id) REFERENCES supplychain_tier1_dict(id)
);

-- ================================
-- 4. 数据来源编码字典表
-- ================================

-- 来源分层字典表
CREATE TABLE IF NOT EXISTS media_tier_code_dict (
  id BIGSERIAL PRIMARY KEY,
  tier_code VARCHAR(32) NOT NULL UNIQUE,
  tier_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 来源角色字典表
CREATE TABLE IF NOT EXISTS media_role_code_dict (
  id BIGSERIAL PRIMARY KEY,
  role_code VARCHAR(32) NOT NULL UNIQUE,
  role_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 覆盖范围字典表
CREATE TABLE IF NOT EXISTS media_coverage_code_dict (
  id BIGSERIAL PRIMARY KEY,
  coverage_code VARCHAR(32) NOT NULL UNIQUE,
  coverage_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 渠道字典表
CREATE TABLE IF NOT EXISTS media_channel_code_dict (
  id BIGSERIAL PRIMARY KEY,
  channel_code VARCHAR(32) NOT NULL UNIQUE,
  channel_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 组织属性字典表
CREATE TABLE IF NOT EXISTS media_ownership_code_dict (
  id BIGSERIAL PRIMARY KEY,
  ownership_code VARCHAR(32) NOT NULL UNIQUE,
  ownership_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 数据来源编码字典表
CREATE TABLE IF NOT EXISTS media_data_source_dict (
  id BIGSERIAL PRIMARY KEY,
  source_code VARCHAR(32) NOT NULL UNIQUE,
  source_name VARCHAR(100) NOT NULL,
  tier_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  coverage_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL,
  ownership_id BIGINT NOT NULL,
  url VARCHAR(255),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tier_id) REFERENCES media_tier_code_dict(id),
  FOREIGN KEY (role_id) REFERENCES media_role_code_dict(id),
  FOREIGN KEY (coverage_id) REFERENCES media_coverage_code_dict(id),
  FOREIGN KEY (channel_id) REFERENCES media_channel_code_dict(id),
  FOREIGN KEY (ownership_id) REFERENCES media_ownership_code_dict(id)
);

-- 访问与授权一级字典表
CREATE TABLE IF NOT EXISTS media_access_l1_code_dict (
  id BIGSERIAL PRIMARY KEY,
  access_l1_code VARCHAR(32) NOT NULL UNIQUE,
  access_l1_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 访问与授权二级字典表
CREATE TABLE IF NOT EXISTS media_access_l2_code_dict (
  id BIGSERIAL PRIMARY KEY,
  access_l1_id BIGINT NOT NULL,
  access_l2_code VARCHAR(32) NOT NULL UNIQUE,
  access_l2_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (access_l1_id) REFERENCES media_access_l1_code_dict(id)
);

-- 数据来源访问与授权配置表
CREATE TABLE IF NOT EXISTS media_data_source_access (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL,
  access_l2_id BIGINT NOT NULL,
  auth_status VARCHAR(32) NOT NULL,
  is_purchased SMALLINT NOT NULL,
  auth_start_time TIMESTAMP,
  auth_end_time TIMESTAMP,
  access_account VARCHAR(100),
  access_password VARCHAR(255),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES media_data_source_dict(id),
  FOREIGN KEY (access_l2_id) REFERENCES media_access_l2_code_dict(id)
);

-- 内容定位一级字典表
CREATE TABLE IF NOT EXISTS media_domain_focus_l1_code_dict (
  id BIGSERIAL PRIMARY KEY,
  domain_focus_l1_code VARCHAR(32) NOT NULL UNIQUE,
  domain_focus_l1_name VARCHAR(50) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 内容定位二级字典表
CREATE TABLE IF NOT EXISTS media_domain_focus_l2_code_dict (
  id BIGSERIAL PRIMARY KEY,
  domain_focus_l1_id BIGINT NOT NULL,
  domain_focus_l2_code VARCHAR(32) NOT NULL UNIQUE,
  domain_focus_l2_name VARCHAR(50) NOT NULL,
  domain_focus_l2_desc VARCHAR(255),
  keywords_example VARCHAR(255),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_focus_l1_id) REFERENCES media_domain_focus_l1_code_dict(id)
);

-- 文本内容类型字典表
CREATE TABLE IF NOT EXISTS media_text_content_type_code_dict (
  id BIGSERIAL PRIMARY KEY,
  content_type_code VARCHAR(32) NOT NULL UNIQUE,
  content_type_name VARCHAR(100) NOT NULL,
  definition VARCHAR(255),
  include_rule VARCHAR(255),
  exclude_rule VARCHAR(255),
  decision_method VARCHAR(255),
  priority_rule VARCHAR(255),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 事实性等级字典表
CREATE TABLE IF NOT EXISTS media_factuality_code_dict (
  id BIGSERIAL PRIMARY KEY,
  factuality_code VARCHAR(32) NOT NULL UNIQUE,
  factuality_name VARCHAR(50) NOT NULL,
  definition VARCHAR(255),
  typical_clues VARCHAR(255),
  usage_suggestion VARCHAR(255),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 情绪极性字典表
CREATE TABLE IF NOT EXISTS media_polarity_code_dict (
  id BIGSERIAL PRIMARY KEY,
  polarity_code VARCHAR(32) NOT NULL UNIQUE,
  polarity_name VARCHAR(50) NOT NULL,
  definition VARCHAR(255),
  decision_rule VARCHAR(255),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 情绪类别字典表
CREATE TABLE IF NOT EXISTS media_emotion_code_dict (
  id BIGSERIAL PRIMARY KEY,
  emotion_code VARCHAR(32) NOT NULL UNIQUE,
  emotion_name VARCHAR(50) NOT NULL,
  definition VARCHAR(255),
  common_triggers VARCHAR(255),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文本内容分类字典表
CREATE TABLE IF NOT EXISTS media_text_category_dict (
  id BIGSERIAL PRIMARY KEY,
  category_code VARCHAR(32) NOT NULL UNIQUE,
  category_name VARCHAR(50) NOT NULL,
  domain_focus_l2_id BIGINT NOT NULL,
  content_type_id BIGINT NOT NULL,
  factuality_id BIGINT NOT NULL,
  polarity_id BIGINT NOT NULL,
  emotion_id BIGINT NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_focus_l2_id) REFERENCES media_domain_focus_l2_code_dict(id),
  FOREIGN KEY (content_type_id) REFERENCES media_text_content_type_code_dict(id),
  FOREIGN KEY (factuality_id) REFERENCES media_factuality_code_dict(id),
  FOREIGN KEY (polarity_id) REFERENCES media_polarity_code_dict(id),
  FOREIGN KEY (emotion_id) REFERENCES media_emotion_code_dict(id)
);

-- ================================
-- 5. 地理位置编码字典表
-- ================================

-- 联合国大区字典表
CREATE TABLE IF NOT EXISTS un_region_dict (
  id BIGSERIAL PRIMARY KEY,
  region_code VARCHAR(16) NOT NULL UNIQUE,
  region_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 联合国次区域字典表
CREATE TABLE IF NOT EXISTS un_subregion_dict (
  id BIGSERIAL PRIMARY KEY,
  region_id BIGINT NOT NULL,
  subregion_code VARCHAR(16) NOT NULL UNIQUE,
  subregion_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (region_id) REFERENCES un_region_dict(id)
);

-- 国家编码字典表
CREATE TABLE IF NOT EXISTS country_code_dict (
  id BIGSERIAL PRIMARY KEY,
  subregion_id BIGINT NOT NULL,
  iso2_code VARCHAR(8) NOT NULL UNIQUE,
  iso3_code VARCHAR(8) NOT NULL UNIQUE,
  m49_code INT NOT NULL UNIQUE,
  country_name VARCHAR(64) NOT NULL,
  FOREIGN KEY (subregion_id) REFERENCES un_subregion_dict(id)
);

-- UN/LOCODE 点位字典表
CREATE TABLE IF NOT EXISTS locode_point_dict (
  id BIGSERIAL PRIMARY KEY,
  country_id BIGINT NOT NULL,
  locode_country VARCHAR(8) NOT NULL,
  locode_place VARCHAR(8) NOT NULL,
  locode_code VARCHAR(16) NOT NULL UNIQUE,
  longitude FLOAT,
  latitude FLOAT,
  port BOOLEAN,
  rail BOOLEAN,
  road BOOLEAN,
  airport BOOLEAN,
  postal BOOLEAN,
  inland_waterway BOOLEAN,
  terminal BOOLEAN,
  fixed_transport BOOLEAN,
  FOREIGN KEY (country_id) REFERENCES country_code_dict(id)
);

-- 运输方式字典表
CREATE TABLE IF NOT EXISTS transport_type_dict (
  id BIGSERIAL PRIMARY KEY,
  transport_type_code VARCHAR(8) NOT NULL UNIQUE,
  transport_type_name VARCHAR(32) NOT NULL
);

-- 运输线路编码字典表
CREATE TABLE IF NOT EXISTS transport_route_dict (
  id BIGSERIAL PRIMARY KEY,
  route_code VARCHAR(32) NOT NULL UNIQUE,
  route_name VARCHAR(100) NOT NULL,
  start_point_id BIGINT NOT NULL,
  end_point_id BIGINT NOT NULL,
  transport_type_id BIGINT NOT NULL,
  FOREIGN KEY (start_point_id) REFERENCES locode_point_dict(id),
  FOREIGN KEY (end_point_id) REFERENCES locode_point_dict(id),
  FOREIGN KEY (transport_type_id) REFERENCES transport_type_dict(id)
);

-- 国家到国家运输线路表
CREATE TABLE IF NOT EXISTS country_transport_route_dict (
  id BIGSERIAL PRIMARY KEY,
  route_code VARCHAR(32) NOT NULL UNIQUE,
  start_country_id BIGINT NOT NULL,
  end_country_id BIGINT NOT NULL,
  transport_type_id BIGINT NOT NULL,
  edge_count INT NOT NULL,
  weight NUMERIC(12,4),
  is_directed SMALLINT NOT NULL,
  is_active SMALLINT NOT NULL,
  FOREIGN KEY (start_country_id) REFERENCES country_code_dict(id),
  FOREIGN KEY (end_country_id) REFERENCES country_code_dict(id),
  FOREIGN KEY (transport_type_id) REFERENCES transport_type_dict(id)
);

-- ================================
-- 6. 风险字典表
-- ================================

-- 一级风险类型字典表
CREATE TABLE IF NOT EXISTS risk_tier1_type_dict (
  id BIGSERIAL PRIMARY KEY,
  risk_tier1_type_code VARCHAR(16) NOT NULL UNIQUE,
  risk_tier1_type_name VARCHAR(50) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 二级风险类型字典表
CREATE TABLE IF NOT EXISTS risk_tier2_type_dict (
  id BIGSERIAL PRIMARY KEY,
  risk_tier1_type_id BIGINT NOT NULL,
  risk_tier2_type_code VARCHAR(32) NOT NULL UNIQUE,
  risk_tier2_type_name VARCHAR(100) NOT NULL,
  risk_level SMALLINT DEFAULT 3,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (risk_tier1_type_id) REFERENCES risk_tier1_type_dict(id)
);

-- 自然灾害灾类字典表
CREATE TABLE IF NOT EXISTS natural_disaster_tier1_dict (
  id BIGSERIAL PRIMARY KEY,
  tier1_code VARCHAR(32) NOT NULL UNIQUE,
  tier1_name VARCHAR(100) NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 自然灾害灾种字典表
CREATE TABLE IF NOT EXISTS natural_disaster_tier2_dict (
  id BIGSERIAL PRIMARY KEY,
  tier2_code VARCHAR(32) NOT NULL UNIQUE,
  tier2_name VARCHAR(100) NOT NULL,
  tier1_id BIGINT NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tier1_id) REFERENCES natural_disaster_tier1_dict(id)
);

-- ================================
-- 7. 业务数据表
-- ================================

-- 事件主表
CREATE TABLE IF NOT EXISTS event_main (
  id BIGSERIAL PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL UNIQUE,
  text_category_id BIGINT,
  event_title VARCHAR(255) NOT NULL,
  event_description TEXT,
  occur_time TIMESTAMP,
  source_id BIGINT NOT NULL,
  supplychain_tier2_id BIGINT,
  domain_focus_l2_id BIGINT,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (text_category_id) REFERENCES media_text_category_dict(id),
  FOREIGN KEY (source_id) REFERENCES media_data_source_dict(id),
  FOREIGN KEY (supplychain_tier2_id) REFERENCES supplychain_tier2_dict(id),
  FOREIGN KEY (domain_focus_l2_id) REFERENCES media_domain_focus_l2_code_dict(id)
);

-- ================================
-- 8. 关联表 (多对多关系)
-- ================================

-- 事件-风险关联表
CREATE TABLE IF NOT EXISTS event_risk_relation (
  id BIGSERIAL PRIMARY KEY,
  event_main_id BIGINT NOT NULL,
  tier2_risk_type_id BIGINT NOT NULL,
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_main_id) REFERENCES event_main(id),
  FOREIGN KEY (tier2_risk_type_id) REFERENCES risk_tier2_type_dict(id)
);

-- 事件-产品关联表
CREATE TABLE IF NOT EXISTS event_product_relation (
  id BIGSERIAL PRIMARY KEY,
  event_main_id BIGINT NOT NULL,
  product_tier3_id BIGINT NOT NULL,
  relation_type_code VARCHAR(16),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_main_id) REFERENCES event_main(id),
  FOREIGN KEY (product_tier3_id) REFERENCES product_tier3_code_dict(id)
);

-- 事件-企业关联表
CREATE TABLE IF NOT EXISTS event_enterprise_relation (
  id BIGSERIAL PRIMARY KEY,
  event_main_id BIGINT NOT NULL,
  enterprise_id BIGINT NOT NULL,
  relation_type_code VARCHAR(16),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_main_id) REFERENCES event_main(id),
  FOREIGN KEY (enterprise_id) REFERENCES enterprise_dict(id)
);

-- 事件-地理关联表
CREATE TABLE IF NOT EXISTS event_geo_relation (
  id BIGSERIAL PRIMARY KEY,
  event_main_id BIGINT NOT NULL,
  locode_point_id BIGINT,
  relation_type_code VARCHAR(16),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_main_id) REFERENCES event_main(id),
  FOREIGN KEY (locode_point_id) REFERENCES locode_point_dict(id)
);

-- ================================
-- 9. 用户管理表
-- ================================

-- 权限字典表
CREATE TABLE IF NOT EXISTS permission_dict (
  id BIGSERIAL PRIMARY KEY,
  permission_code VARCHAR(32) NOT NULL UNIQUE,
  permission_name VARCHAR(100) NOT NULL,
  permission_level INT NOT NULL,
  description VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户账户表
CREATE TABLE IF NOT EXISTS user_account (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  full_name VARCHAR(100),
  is_active SMALLINT DEFAULT 1,
  last_login TIMESTAMP,
  login_count INT DEFAULT 0,
  product_portrait_config JSONB DEFAULT '{}'::JSONB,
  product_portrait_rows JSONB DEFAULT '[]'::JSONB,
  product_portrait_updated_at TIMESTAMP,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255)
);

ALTER TABLE user_account ADD COLUMN IF NOT EXISTS product_portrait_config JSONB DEFAULT '{}'::JSONB;
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS product_portrait_rows JSONB DEFAULT '[]'::JSONB;
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS product_portrait_updated_at TIMESTAMP;

-- 用户权限关联表
CREATE TABLE IF NOT EXISTS user_permission_relation (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  grant_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by BIGINT,
  remark VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES user_account(id),
  FOREIGN KEY (permission_id) REFERENCES permission_dict(id),
  FOREIGN KEY (granted_by) REFERENCES user_account(id),
  UNIQUE(user_id, permission_id)
);

-- ================================
-- 7. 产品画像配置表
-- ================================

-- 用户产品画像配置主表
CREATE TABLE IF NOT EXISTS product_portrait_config (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  focus_industries TEXT[] DEFAULT ARRAY[]::TEXT[],
  risk_sensitivity VARCHAR(16) NOT NULL DEFAULT 'medium',
  watch_regions TEXT[] DEFAULT ARRAY[]::TEXT[],
  min_confidence INT NOT NULL DEFAULT 70,
  notify_by_email BOOLEAN NOT NULL DEFAULT TRUE,
  track_supply_stages TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id)
);

-- 产品画像明细行表
CREATE TABLE IF NOT EXISTS product_portrait_rows (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  product_line VARCHAR(120) NOT NULL,
  coding_system VARCHAR(16) NOT NULL,
  code_value VARCHAR(64) NOT NULL,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  focus_regions TEXT[] DEFAULT ARRAY[]::TEXT[],
  focus_stages TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id, product_line, coding_system, code_value)
);

-- 产品画像版本快照表
CREATE TABLE IF NOT EXISTS product_portrait_versions (
  id BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  version_no INT NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  rows_snapshot JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id, version_no)
);

-- ================================
-- Indexes for Performance
-- ================================
CREATE INDEX IF NOT EXISTS idx_product_tier2_tier1 ON product_tier2_code_dict(tier1_id);
CREATE INDEX IF NOT EXISTS idx_product_tier3_tier2 ON product_tier3_code_dict(tier2_id);
CREATE INDEX IF NOT EXISTS idx_industry_chain_tier3 ON industry_chain_node_dict(tier3_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_industry_tier ON enterprise_dict(tier1_id, tier2_id, tier3_id, tier4_id);
CREATE INDEX IF NOT EXISTS idx_event_main_source ON event_main(source_id);
CREATE INDEX IF NOT EXISTS idx_event_main_occur_time ON event_main(occur_time DESC);
CREATE INDEX IF NOT EXISTS idx_event_risk_relation ON event_risk_relation(event_main_id);
CREATE INDEX IF NOT EXISTS idx_event_product_relation ON event_product_relation(event_main_id);
CREATE INDEX IF NOT EXISTS idx_event_enterprise_relation ON event_enterprise_relation(event_main_id);
CREATE INDEX IF NOT EXISTS idx_event_geo_relation ON event_geo_relation(event_main_id);
CREATE INDEX IF NOT EXISTS idx_media_data_source ON media_data_source_dict(source_code);
CREATE INDEX IF NOT EXISTS idx_transport_route ON transport_route_dict(transport_type_id);
CREATE INDEX IF NOT EXISTS idx_country_transport_route ON country_transport_route_dict(transport_type_id);
CREATE INDEX IF NOT EXISTS idx_user_account_username ON user_account(username);
CREATE INDEX IF NOT EXISTS idx_user_account_email ON user_account(email);
CREATE INDEX IF NOT EXISTS idx_user_permission_relation ON user_permission_relation(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_level ON permission_dict(permission_level);
CREATE INDEX IF NOT EXISTS idx_product_portrait_config_scope ON product_portrait_config(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_product_portrait_rows_scope ON product_portrait_rows(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_product_portrait_versions_scope ON product_portrait_versions(organization_id, user_id, version_no DESC);

-- ================================
-- 示例数据插入
-- ================================

-- 权限字典
INSERT INTO permission_dict (permission_code, permission_name, permission_level, description) VALUES
('ADMIN', '管理员', 3, '拥有数据字典的完全控制权限，包括CRUD、审核、用户管理'),
('EDITOR', '编辑员', 2, '可以创建、修改、删除数据字典项，但需要管理员审核'),
('VIEWER', '查看员', 1, '只能查看数据字典，无修改权限')
ON CONFLICT DO NOTHING;

-- 默认管理员账户 (明文密码: admin123)
-- 密码: admin123
INSERT INTO user_account (username, password_hash, email, full_name, is_active, login_count) VALUES
('admin', 'admin123', 'admin@sentry.local', '系统管理员', 1, 0)
ON CONFLICT DO NOTHING;

-- 为管理员分配管理员权限
INSERT INTO user_permission_relation (user_id, permission_id, granted_by)
SELECT u.id, p.id, u.id FROM user_account u, permission_dict p 
WHERE u.username = 'admin' AND p.permission_code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- 产品一级分类
INSERT INTO product_tier1_code_dict (tier1_code, tier1_name, remark) VALUES
('01', '动物产品', 'HS编码第01章'),
('02', '植物产品', 'HS编码第02章'),
('03', '动物油脂', 'HS编码第03章'),
('04', '食品饮料', 'HS编码第04章'),
('05', '矿产品', 'HS编码第05章')
ON CONFLICT DO NOTHING;

-- 产品二级分类 (HS编码前两位)
INSERT INTO product_tier2_code_dict (tier2_code, tier2_name, tier1_id) 
SELECT '0101', '活马、驴等', id FROM product_tier1_code_dict WHERE tier1_code = '01'
ON CONFLICT DO NOTHING;

-- 产品三级分类 (HS编码前四位)
INSERT INTO product_tier3_code_dict (tier3_code, tier3_name, tier2_id, remark)
SELECT '010100', '纯种繁殖马', id, 'HS编码010100' FROM product_tier2_code_dict WHERE tier2_code = '0101'
ON CONFLICT DO NOTHING;

-- 产业链节点 (供应链中的具体产品节点)
INSERT INTO industry_chain_node_dict (node_code, node_name, tier3_id, remark)
SELECT 'NODE_0101_001', '进口纯种马', id, '来自澳洲的纯种马' FROM product_tier3_code_dict WHERE tier3_code = '010100'
ON CONFLICT DO NOTHING;

-- 一级风险类型
INSERT INTO risk_tier1_type_dict (risk_tier1_type_code, risk_tier1_type_name, remark) VALUES
('LABOR', '劳资纠纷', '港口罢工、工人罢工等'),
('NATURE', '自然灾害', '台风、洪水、地震等'),
('SUPPLY', '供应短缺', '原材料紧缺、产能不足'),
('SECURITY', '网络安全', '数据泄露、系统故障'),
('GEOPOLITICAL', '地缘政治', '战争、制裁、贸易摩擦')
ON CONFLICT DO NOTHING;

-- 二级风险类型
INSERT INTO risk_tier2_type_dict (risk_tier1_type_id, risk_tier2_type_code, risk_tier2_type_name, risk_level)
SELECT id, 'PORT_STRIKE', '港口罢工', 4 FROM risk_tier1_type_dict WHERE risk_tier1_type_code = 'LABOR'
ON CONFLICT DO NOTHING;

INSERT INTO risk_tier2_type_dict (risk_tier1_type_id, risk_tier2_type_code, risk_tier2_type_name, risk_level)
SELECT id, 'TYPHOON', '台风预警', 5 FROM risk_tier1_type_dict WHERE risk_tier1_type_code = 'NATURE'
ON CONFLICT DO NOTHING;

-- 来源分层
INSERT INTO media_tier_code_dict (tier_code, tier_name, remark) VALUES
('MAINSTREAM', '主流媒体', '国家级或大型正规媒体'),
('SPECIALIZED', '专业媒体', '行业专业媒体'),
('SOCIAL', '社交媒体', '微博、推特等社交平台'),
('GOVERNMENT', '官方渠道', '政府部门、贸易协会发布')
ON CONFLICT DO NOTHING;

-- 来源角色
INSERT INTO media_role_code_dict (role_code, role_name, remark) VALUES
('PRIMARY', '一手信息源', '直接报道事件的媒体'),
('SECONDARY', '二手转发', '转载其他媒体报道'),
('ANALYSIS', '分析评论', '专家分析或评论')
ON CONFLICT DO NOTHING;

-- 覆盖范围
INSERT INTO media_coverage_code_dict (coverage_code, coverage_name, remark) VALUES
('GLOBAL', '全球', '国际级别媒体'),
('REGIONAL', '区域', '特定地区媒体'),
('NATIONAL', '国家', '国家级别媒体'),
('LOCAL', '本地', '本地城市媒体')
ON CONFLICT DO NOTHING;

-- 渠道
INSERT INTO media_channel_code_dict (channel_code, channel_name, remark) VALUES
('ONLINE', '在线新闻', '网络新闻网站'),
('PRINT', '报纸杂志', '纸质媒体'),
('BROADCAST', '广播电视', '电视广播'),
('SOCIAL_MEDIA', '社交媒体', '社交平台')
ON CONFLICT DO NOTHING;

-- 组织属性
INSERT INTO media_ownership_code_dict (ownership_code, ownership_name, remark) VALUES
('STATE', '国有媒体', '政府控股或管理'),
('COMMERCIAL', '商业媒体', '民营或私人媒体'),
('HYBRID', '混合所有制', '国有和私人混合'),
('NGO', '非营利组织', 'NGO或非盈利组织')
ON CONFLICT DO NOTHING;

-- 企业一级行业分类
INSERT INTO enterprise_industry_tier1_dict (tier1_code, tier1_name, remark) VALUES
('A', '农业、林业、渔业和动物饲养', 'ISIC Tier1'),
('B', '采矿和采石', 'ISIC Tier1'),
('C', '制造业', 'ISIC Tier1'),
('D', '电力、燃气、蒸汽和空调供应', 'ISIC Tier1'),
('E', '供水、污水、废弃物处理', 'ISIC Tier1')
ON CONFLICT DO NOTHING;

-- 企业二级行业分类
INSERT INTO enterprise_industry_tier2_dict (tier2_code, tier2_name, tier1_id)
SELECT '01', '田间作物', id FROM enterprise_industry_tier1_dict WHERE tier1_code = 'A'
ON CONFLICT DO NOTHING;

-- 企业三级行业分类
INSERT INTO enterprise_industry_tier3_dict (tier3_code, tier3_name, tier2_id)
SELECT '011', '谷物生产', id FROM enterprise_industry_tier2_dict WHERE tier2_code = '01'
ON CONFLICT DO NOTHING;

-- 企业四级行业分类
INSERT INTO enterprise_industry_tier4_dict (tier4_code, tier4_name, tier3_id)
SELECT '0111', '水稻种植', id FROM enterprise_industry_tier3_dict WHERE tier3_code = '011'
ON CONFLICT DO NOTHING;

-- 联合国大区
INSERT INTO un_region_dict (region_code, region_name, remark) VALUES
('002', '非洲', 'Africa'),
('142', '亚洲', 'Asia'),
('150', '欧洲', 'Europe'),
('019', '美洲', 'Americas'),
('009', '大洋洲', 'Oceania')
ON CONFLICT DO NOTHING;

-- 联合国次区域
INSERT INTO un_subregion_dict (region_id, subregion_code, subregion_name)
SELECT id, '030', '东亚' FROM un_region_dict WHERE region_code = '142'
ON CONFLICT DO NOTHING;

INSERT INTO un_subregion_dict (region_id, subregion_code, subregion_name)
SELECT id, '035', '东南亚' FROM un_region_dict WHERE region_code = '142'
ON CONFLICT DO NOTHING;

-- 国家编码
INSERT INTO country_code_dict (subregion_id, iso2_code, iso3_code, m49_code, country_name)
SELECT id, 'CN', 'CHN', 156, '中国' FROM un_subregion_dict WHERE subregion_code = '030'
ON CONFLICT DO NOTHING;

INSERT INTO country_code_dict (subregion_id, iso2_code, iso3_code, m49_code, country_name)
SELECT id, 'SG', 'SGP', 702, '新加坡' FROM un_subregion_dict WHERE subregion_code = '035'
ON CONFLICT DO NOTHING;

-- 运输方式
INSERT INTO transport_type_dict (transport_type_code, transport_type_name) VALUES
('SEA', '海运'),
('AIR', '空运'),
('ROAD', '陆运'),
('RAIL', '铁路运输')
ON CONFLICT DO NOTHING;

-- 供应链流程
INSERT INTO supplychain_tier1_dict (tier1_code, tier1_name, tier1_name_en, sequence_no, standard_input, standard_output, status, remark) VALUES
('SC01', '生产制造', 'Manufacturing', 1, '原材料', '成品', 1, '工厂生产环节'),
('SC02', '港口码头', 'Port', 2, '成品', '待运货物', 1, '港口装卸环节'),
('SC03', '仓储配送', 'Warehouse', 3, '待运货物', '待派送货物', 1, '仓库存储环节'),
('SC04', '末端派送', 'Last-mile', 4, '待派送货物', '送达终端', 1, '最后一公里配送')
ON CONFLICT DO NOTHING;

INSERT INTO supplychain_tier2_dict (tier2_code, tier1_id, tier2_name, tier2_name_en, sequence_no, status, remark)
SELECT 'SC01_01', id, '采购原材料', 'Procurement', 1, 1, '从供应商采购' FROM supplychain_tier1_dict WHERE tier1_code = 'SC01'
ON CONFLICT DO NOTHING;

INSERT INTO supplychain_tier2_dict (tier2_code, tier1_id, tier2_name, tier2_name_en, sequence_no, status, remark)
SELECT 'SC01_02', id, '生产加工', 'Production', 2, 1, '工厂内加工生产' FROM supplychain_tier1_dict WHERE tier1_code = 'SC01'
ON CONFLICT DO NOTHING;

INSERT INTO supplychain_tier2_dict (tier2_code, tier1_id, tier2_name, tier2_name_en, sequence_no, status, remark)
SELECT 'SC02_01', id, '码头装卸', 'Loading', 3, 1, '港口装船卸货' FROM supplychain_tier1_dict WHERE tier1_code = 'SC02'
ON CONFLICT DO NOTHING;

-- 内容定位一级
INSERT INTO media_domain_focus_l1_code_dict (domain_focus_l1_code, domain_focus_l1_name, remark) VALUES
('SUPPLY_CHAIN', '供应链风险', '与供应链相关的内容'),
('LABOR', '劳资关系', '与劳资纠纷相关的内容'),
('ENVIRONMENTAL', '环境问题', '与环保相关的内容')
ON CONFLICT DO NOTHING;

-- 内容定位二级
INSERT INTO media_domain_focus_l2_code_dict (domain_focus_l1_id, domain_focus_l2_code, domain_focus_l2_name, keywords_example)
SELECT id, 'SC_PORT', '港口风险', '港口、码头、罢工、延误' FROM media_domain_focus_l1_code_dict WHERE domain_focus_l1_code = 'SUPPLY_CHAIN'
ON CONFLICT DO NOTHING;

INSERT INTO media_domain_focus_l2_code_dict (domain_focus_l1_id, domain_focus_l2_code, domain_focus_l2_name, keywords_example)
SELECT id, 'SC_LOGISTICS', '物流风险', '物流、运输、海运、空运' FROM media_domain_focus_l1_code_dict WHERE domain_focus_l1_code = 'SUPPLY_CHAIN'
ON CONFLICT DO NOTHING;

INSERT INTO media_domain_focus_l2_code_dict (domain_focus_l1_id, domain_focus_l2_code, domain_focus_l2_name, keywords_example)
SELECT id, 'LR_STRIKE', '工人罢工', '罢工、劳资纠纷、工资' FROM media_domain_focus_l1_code_dict WHERE domain_focus_l1_code = 'LABOR'
ON CONFLICT DO NOTHING;

-- 文本内容类型
INSERT INTO media_text_content_type_code_dict (content_type_code, content_type_name, definition) VALUES
('NEWS', '新闻报道', '新闻媒体发布的事件报道'),
('ANNOUNCEMENT', '公告声明', '官方部门发布的公告'),
('ANALYSIS', '分析评论', '专家或媒体发布的分析'),
('REPORT', '研究报告', '研究机构发布的报告')
ON CONFLICT DO NOTHING;

-- 事实性等级
INSERT INTO media_factuality_code_dict (factuality_code, factuality_name, definition, usage_suggestion) VALUES
('VERIFIED', '已验证', '经过多方验证的事实', '可直接使用'),
('PROBABLE', '可能', '有一定证据支持但未完全验证', '谨慎使用'),
('UNVERIFIED', '未验证', '只有单一来源报道', '需要进一步验证'),
('DISPUTED', '有争议', '存在不同观点和争议', '需要标注争议')
ON CONFLICT DO NOTHING;

-- 情绪极性
INSERT INTO media_polarity_code_dict (polarity_code, polarity_name, definition) VALUES
('POSITIVE', '正面', '表达积极、利好的态度'),
('NEGATIVE', '负面', '表达消极、不利的态度'),
('NEUTRAL', '中立', '客观陈述事实，无明显倾向')
ON CONFLICT DO NOTHING;

-- 情绪类别
INSERT INTO media_emotion_code_dict (emotion_code, emotion_name, definition, common_triggers) VALUES
('ANXIETY', '焦虑', '表达担忧、不确定性', '风险预警、潜在威胁'),
('OPTIMISM', '乐观', '表达希望、积极前景', '解决方案、恢复迹象'),
('FRUSTRATION', '沮丧', '表达失望、无奈', '延误、失败、困境'),
('ALERT', '警惕', '表达紧迫感、需要行动', '危险、危机、紧急情况')
ON CONFLICT DO NOTHING;

-- 自然灾害灾类
INSERT INTO natural_disaster_tier1_dict (tier1_code, tier1_name, remark) VALUES
('01', '气象水文灾害', '暴雨、台风、洪水等'),
('02', '地质灾害', '地震、滑坡、泥石流等'),
('03', '生物灾害', '病虫害、动物疫病等'),
('04', '海洋灾害', '海啸、风暴潮等')
ON CONFLICT DO NOTHING;

-- 自然灾害灾种
INSERT INTO natural_disaster_tier2_dict (tier2_code, tier2_name, tier1_id)
SELECT '0101', '暴雨', id FROM natural_disaster_tier1_dict WHERE tier1_code = '01'
ON CONFLICT DO NOTHING;

INSERT INTO natural_disaster_tier2_dict (tier2_code, tier2_name, tier1_id)
SELECT '0102', '台风', id FROM natural_disaster_tier1_dict WHERE tier1_code = '01'
ON CONFLICT DO NOTHING;

INSERT INTO natural_disaster_tier2_dict (tier2_code, tier2_name, tier1_id)
SELECT '0103', '洪水', id FROM natural_disaster_tier1_dict WHERE tier1_code = '01'
ON CONFLICT DO NOTHING;

INSERT INTO natural_disaster_tier2_dict (tier2_code, tier2_name, tier1_id)
SELECT '0201', '地震', id FROM natural_disaster_tier1_dict WHERE tier1_code = '02'
ON CONFLICT DO NOTHING;
