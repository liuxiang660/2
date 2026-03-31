-- Demo seed data for end-to-end feature validation
-- Safe to run multiple times (idempotent where possible)

BEGIN;

-- ================================
-- Base dictionaries: permissions + users
-- ================================
INSERT INTO permission_dict (permission_code, permission_name, permission_level, description)
VALUES
  ('ADMIN', '管理员', 3, '平台管理权限'),
  ('EDITOR', '编辑员', 2, '编辑权限'),
  ('VIEWER', '查看员', 1, '只读权限')
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    permission_level = EXCLUDED.permission_level,
    description = EXCLUDED.description;

INSERT INTO user_account (
  username,
  password_hash,
  email,
  full_name,
  is_active,
  login_count
)
VALUES
  (
    'admin',
    'admin123',
    'admin@sentry.local',
    '系统管理员',
    1,
    0
  ),
  (
    'analyst',
    'analyst123',
    'analyst@sentry.local',
    '风险分析师',
    1,
    0
  )
ON CONFLICT (username) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    is_active = EXCLUDED.is_active,
    login_count = user_account.login_count;

DO $$
BEGIN
  -- 兼容旧库：仅在列存在时写入画像字段
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_account' AND column_name = 'product_portrait_config'
  ) THEN
    UPDATE user_account
    SET product_portrait_config = '{"focusIndustries":["消费电子","新能源"],"riskSensitivity":"high","watchRegions":["亚太","欧洲"],"minConfidence":70,"notifyByEmail":true,"trackSupplyStages":["生产制造","港口码头"]}'::jsonb
    WHERE username = 'admin';

    UPDATE user_account
    SET product_portrait_config = '{"focusIndustries":["汽车制造"],"riskSensitivity":"medium","watchRegions":["北美","欧洲"],"minConfidence":65,"notifyByEmail":false,"trackSupplyStages":["仓储配送","末端派送"]}'::jsonb
    WHERE username = 'analyst';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_account' AND column_name = 'product_portrait_rows'
  ) THEN
    UPDATE user_account
    SET product_portrait_rows = '[{"productLine":"消费电子","codingSystem":"HS","codeValue":"8542","keywords":["芯片","半导体"],"focusRegions":["亚太","欧洲"],"focusStages":["生产制造","港口码头"]}]'::jsonb
    WHERE username = 'admin';

    UPDATE user_account
    SET product_portrait_rows = '[]'::jsonb
    WHERE username = 'analyst';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_account' AND column_name = 'product_portrait_updated_at'
  ) THEN
    UPDATE user_account
    SET product_portrait_updated_at = NOW()
    WHERE username IN ('admin', 'analyst');
  END IF;
END
$$;

INSERT INTO user_permission_relation (user_id, permission_id, granted_by)
SELECT u.id, p.id, u.id
FROM user_account u
JOIN permission_dict p ON p.permission_code = 'ADMIN'
WHERE u.username = 'admin'
ON CONFLICT (user_id, permission_id) DO NOTHING;

INSERT INTO user_permission_relation (user_id, permission_id, granted_by)
SELECT u.id, p.id, (SELECT id FROM user_account WHERE username = 'admin' LIMIT 1)
FROM user_account u
JOIN permission_dict p ON p.permission_code = 'EDITOR'
WHERE u.username = 'analyst'
ON CONFLICT (user_id, permission_id) DO NOTHING;

-- ================================
-- Product tiers + supply topology
-- ================================
INSERT INTO product_tier1_code_dict (tier1_code, tier1_name, remark)
VALUES
  ('85', '电子电气设备', '测试数据'),
  ('87', '车辆及零部件', '测试数据'),
  ('28', '无机化学品', '测试数据'),
  ('27', '矿物燃料，矿物油', '能源相关产品')
ON CONFLICT (tier1_code) DO UPDATE
SET tier1_name = EXCLUDED.tier1_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO product_tier2_code_dict (tier2_code, tier2_name, tier1_id)
SELECT x.tier2_code, x.tier2_name, t1.id
FROM (
  VALUES
    ('8507', '蓄电池', '85'),
    ('8542', '集成电路', '85'),
    ('8708', '机动车零件', '87'),
    ('2709', '原油', '27'),
    ('2711', '天然气', '27')
) AS x(tier2_code, tier2_name, tier1_code)
JOIN product_tier1_code_dict t1 ON t1.tier1_code = x.tier1_code
ON CONFLICT (tier2_code) DO UPDATE
SET tier2_name = EXCLUDED.tier2_name,
    tier1_id = EXCLUDED.tier1_id,
    update_time = NOW();

INSERT INTO product_tier3_code_dict (tier3_code, tier3_name, tier2_id, remark)
SELECT x.tier3_code, x.tier3_name, t2.id, 'seed'
FROM (
  VALUES
    ('850760', '锂离子蓄电池', '8507'),
    ('854231', '处理器及控制器', '8542'),
    ('870899', '车辆其他零件', '8708'),
    ('270900', '中东原油', '2709'),
    ('271100', '液化天然气', '2711')
) AS x(tier3_code, tier3_name, tier2_code)
JOIN product_tier2_code_dict t2 ON t2.tier2_code = x.tier2_code
ON CONFLICT (tier3_code) DO UPDATE
SET tier3_name = EXCLUDED.tier3_name,
    tier2_id = EXCLUDED.tier2_id,
    remark = EXCLUDED.remark,
    update_time = NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'industry_chain_node_dict'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'industry_chain_node_dict' AND column_name = 'risk_level'
    ) THEN
      ALTER TABLE industry_chain_node_dict ADD COLUMN risk_level SMALLINT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'industry_chain_node_dict' AND column_name = 'delay_hours'
    ) THEN
      ALTER TABLE industry_chain_node_dict ADD COLUMN delay_hours INT;
    END IF;
  END IF;
END
$$;

INSERT INTO industry_chain_node_dict (node_code, node_name, tier3_id, risk_level, delay_hours, remark)
SELECT x.node_code, x.node_name, t3.id, x.risk_level, x.delay_hours, x.remark
FROM (
  VALUES
    ('CMP-CHIP-01', '晶圆代工厂', '854231', 4, 36, '产能紧张'),
    ('BAT-CELL-01', '电芯制造厂', '850760', 3, 18, '上游供应波动'),
    ('PORT-SIN-01', '新加坡港中转', '870899', 2, 6, '台风后恢复中'),
    ('WH-EU-01', '欧洲区域仓', '870899', 1, 2, '运行正常'),
    ('OIL-RAS-01', '伊朗拉斯塔努拉油脂', '270900', 5, 48, '地缘政治风险高'),
    ('GAS-HORMU-01', '霍尔木兹海峡LNG过站点', '271100', 5, 72, '全球最重要油气运输枢纽')
) AS x(node_code, node_name, tier3_code, risk_level, delay_hours, remark)
JOIN product_tier3_code_dict t3 ON t3.tier3_code = x.tier3_code
ON CONFLICT (node_code) DO UPDATE
SET node_name = EXCLUDED.node_name,
    tier3_id = EXCLUDED.tier3_id,
    risk_level = EXCLUDED.risk_level,
    delay_hours = EXCLUDED.delay_hours,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO industry_chain_node_relation (upstream_node_id, downstream_node_id, relation_type, remark)
SELECT up.id, down.id, rel.relation_type, rel.remark
FROM (
  VALUES
    ('CMP-CHIP-01', 'BAT-CELL-01', '供给', '芯片供给电芯厂'),
    ('BAT-CELL-01', 'PORT-SIN-01', '运输', '海运出港'),
    ('PORT-SIN-01', 'WH-EU-01', '配送', '到仓分拨'),
    ('OIL-RAS-01', 'GAS-HORMU-01', '运输', '伊朗原油通过霍尔木兹海峡运往全球')
) AS rel(up_code, down_code, relation_type, remark)
JOIN industry_chain_node_dict up ON up.node_code = rel.up_code
JOIN industry_chain_node_dict down ON down.node_code = rel.down_code
WHERE NOT EXISTS (
  SELECT 1
  FROM industry_chain_node_relation e
  WHERE e.upstream_node_id = up.id
    AND e.downstream_node_id = down.id
);

-- ================================
-- Enterprise + supply process dictionaries
-- ================================
INSERT INTO enterprise_industry_tier1_dict (tier1_code, tier1_name, is_active, remark)
VALUES
  ('C', '制造业', '1', 'seed'),
  ('H', '运输和仓储业', '1', 'seed')
ON CONFLICT (tier1_code) DO UPDATE
SET tier1_name = EXCLUDED.tier1_name,
    is_active = EXCLUDED.is_active,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO enterprise_industry_tier2_dict (tier2_code, tier2_name, tier1_id, is_active, remark)
SELECT x.tier2_code, x.tier2_name, t1.id, '1', 'seed'
FROM (
  VALUES
    ('26', '计算机、通信和其他电子设备制造业', 'C'),
    ('52', '仓储业', 'H')
) AS x(tier2_code, tier2_name, tier1_code)
JOIN enterprise_industry_tier1_dict t1 ON t1.tier1_code = x.tier1_code
ON CONFLICT (tier2_code) DO UPDATE
SET tier2_name = EXCLUDED.tier2_name,
    tier1_id = EXCLUDED.tier1_id,
    is_active = EXCLUDED.is_active,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO enterprise_industry_tier3_dict (tier3_code, tier3_name, tier2_id, is_active, remark)
SELECT x.tier3_code, x.tier3_name, t2.id, '1', 'seed'
FROM (
  VALUES
    ('261', '电子元件制造', '26'),
    ('521', '普通货物仓储', '52')
) AS x(tier3_code, tier3_name, tier2_code)
JOIN enterprise_industry_tier2_dict t2 ON t2.tier2_code = x.tier2_code
ON CONFLICT (tier3_code) DO UPDATE
SET tier3_name = EXCLUDED.tier3_name,
    tier2_id = EXCLUDED.tier2_id,
    is_active = EXCLUDED.is_active,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO enterprise_industry_tier4_dict (tier4_code, tier4_name, tier3_id, is_active, remark)
SELECT x.tier4_code, x.tier4_name, t3.id, '1', 'seed'
FROM (
  VALUES
    ('2610', '半导体器件制造', '261'),
    ('5210', '区域仓储服务', '521')
) AS x(tier4_code, tier4_name, tier3_code)
JOIN enterprise_industry_tier3_dict t3 ON t3.tier3_code = x.tier3_code
ON CONFLICT (tier4_code) DO UPDATE
SET tier4_name = EXCLUDED.tier4_name,
    tier3_id = EXCLUDED.tier3_id,
    is_active = EXCLUDED.is_active,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO enterprise_dict (
  enterprise_code,
  code_type,
  enterprise_name,
  register_date,
  register_capital,
  legal_representative,
  is_listed,
  stock_exchange,
  stock_name,
  stock_code,
  tier1_id,
  tier2_id,
  tier3_id,
  tier4_id,
  remark
)
SELECT
  x.enterprise_code,
  1,
  x.enterprise_name,
  DATE '2020-01-01',
  x.register_capital,
  x.legal_representative,
  x.is_listed,
  x.stock_exchange,
  x.stock_name,
  x.stock_code,
  t1.id,
  t2.id,
  t3.id,
  t4.id,
  'seed'
FROM (
  VALUES
    ('91310000A100000001', '华东芯源科技', 5000.00, '张明', 1, 'SSE', '芯源科技', '688001', 'C', '26', '261', '2610'),
    ('91310000A100000002', '欧陆联运仓配', 3000.00, '李强', 0, NULL, NULL, NULL, 'H', '52', '521', '5210')
) AS x(enterprise_code, enterprise_name, register_capital, legal_representative, is_listed, stock_exchange, stock_name, stock_code, t1c, t2c, t3c, t4c)
JOIN enterprise_industry_tier1_dict t1 ON t1.tier1_code = x.t1c
JOIN enterprise_industry_tier2_dict t2 ON t2.tier2_code = x.t2c
JOIN enterprise_industry_tier3_dict t3 ON t3.tier3_code = x.t3c
JOIN enterprise_industry_tier4_dict t4 ON t4.tier4_code = x.t4c
ON CONFLICT (enterprise_code) DO UPDATE
SET enterprise_name = EXCLUDED.enterprise_name,
    register_capital = EXCLUDED.register_capital,
    legal_representative = EXCLUDED.legal_representative,
    is_listed = EXCLUDED.is_listed,
    stock_exchange = EXCLUDED.stock_exchange,
    stock_name = EXCLUDED.stock_name,
    stock_code = EXCLUDED.stock_code,
    tier1_id = EXCLUDED.tier1_id,
    tier2_id = EXCLUDED.tier2_id,
    tier3_id = EXCLUDED.tier3_id,
    tier4_id = EXCLUDED.tier4_id,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO supplychain_tier1_dict (tier1_code, tier1_name, tier1_name_en, sequence_no, standard_input, standard_output, status, remark)
VALUES
  ('SC01', '生产制造', 'Manufacturing', 1, '原材料', '半成品/成品', 1, 'seed'),
  ('SC02', '港口码头', 'Port', 2, '集装箱货物', '待清关货物', 1, 'seed'),
  ('SC03', '仓储配送', 'Warehouse', 3, '待分拨货物', '区域库存', 1, 'seed'),
  ('SC04', '末端派送', 'Last Mile', 4, '区域库存', '终端交付', 1, 'seed')
ON CONFLICT (sequence_no) DO UPDATE
SET tier1_code = EXCLUDED.tier1_code,
    tier1_name = EXCLUDED.tier1_name,
    tier1_name_en = EXCLUDED.tier1_name_en,
    standard_input = EXCLUDED.standard_input,
    standard_output = EXCLUDED.standard_output,
    status = EXCLUDED.status,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO supplychain_tier2_dict (tier2_code, tier1_id, tier2_name, tier2_name_en, sequence_no, input_spec, output_spec, key_activities, trigger_condition, status, remark)
SELECT x.tier2_code, t1.id, x.tier2_name, x.tier2_name_en, x.sequence_no, x.input_spec, x.output_spec, x.key_activities, x.trigger_condition, 1, 'seed'
FROM (
  VALUES
    ('SC01-ASM', 'SC01', '组装生产', 'Assembly', 11, '芯片、电芯', '模组', '组装、测试', '原料齐备'),
    ('SC02-HUB', 'SC02', '港口中转', 'Port Hub', 21, '模组', '在途货物', '装卸、报关', '船期到港'),
    ('SC03-CDC', 'SC03', '区域分拨', 'Regional Distribution', 31, '在途货物', '分拨包裹', '分拣、入库', '到港后48小时')
) AS x(tier2_code, tier1_code, tier2_name, tier2_name_en, sequence_no, input_spec, output_spec, key_activities, trigger_condition)
JOIN supplychain_tier1_dict t1 ON t1.tier1_code = x.tier1_code
ON CONFLICT (sequence_no) DO UPDATE
SET tier2_code = EXCLUDED.tier2_code,
    tier1_id = EXCLUDED.tier1_id,
    tier2_name = EXCLUDED.tier2_name,
    tier2_name_en = EXCLUDED.tier2_name_en,
    input_spec = EXCLUDED.input_spec,
    output_spec = EXCLUDED.output_spec,
    key_activities = EXCLUDED.key_activities,
    trigger_condition = EXCLUDED.trigger_condition,
    status = EXCLUDED.status,
    remark = EXCLUDED.remark,
    update_time = NOW();

-- ================================
-- Media dictionaries
-- ================================
INSERT INTO media_tier_code_dict (tier_code, tier_name, remark)
VALUES
  ('MAINSTREAM', '主流媒体', 'seed'),
  ('SPECIALIZED', '行业媒体', 'seed')
ON CONFLICT (tier_code) DO UPDATE
SET tier_name = EXCLUDED.tier_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_role_code_dict (role_code, role_name, remark)
VALUES
  ('PRIMARY', '一手源', 'seed'),
  ('ANALYSIS', '分析源', 'seed')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_coverage_code_dict (coverage_code, coverage_name, remark)
VALUES
  ('GLOBAL', '全球', 'seed'),
  ('REGIONAL', '区域', 'seed')
ON CONFLICT (coverage_code) DO UPDATE
SET coverage_name = EXCLUDED.coverage_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_channel_code_dict (channel_code, channel_name, remark)
VALUES
  ('ONLINE', '在线', 'seed'),
  ('SOCIAL', '社媒', 'seed')
ON CONFLICT (channel_code) DO UPDATE
SET channel_name = EXCLUDED.channel_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_ownership_code_dict (ownership_code, ownership_name, remark)
VALUES
  ('COMMERCIAL', '商业媒体', 'seed'),
  ('STATE', '官方媒体', 'seed')
ON CONFLICT (ownership_code) DO UPDATE
SET ownership_name = EXCLUDED.ownership_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_access_l1_code_dict (access_l1_code, access_l1_name, remark)
VALUES
  ('PUBLIC', '公开访问', 'seed'),
  ('PAID', '付费访问', 'seed')
ON CONFLICT (access_l1_code) DO UPDATE
SET access_l1_name = EXCLUDED.access_l1_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_access_l2_code_dict (access_l1_id, access_l2_code, access_l2_name, remark)
SELECT l1.id, x.code, x.name, 'seed'
FROM (
  VALUES
    ('PUBLIC', 'PUBLIC_WEB', '公开网页'),
    ('PAID', 'PAID_API', '付费API')
) AS x(l1_code, code, name)
JOIN media_access_l1_code_dict l1 ON l1.access_l1_code = x.l1_code
ON CONFLICT (access_l2_code) DO UPDATE
SET access_l1_id = EXCLUDED.access_l1_id,
    access_l2_name = EXCLUDED.access_l2_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_data_source_dict (source_code, source_name, tier_id, role_id, coverage_id, channel_id, ownership_id, url, remark)
SELECT
  x.source_code,
  x.source_name,
  mt.id,
  mr.id,
  mc.id,
  mch.id,
  mo.id,
  x.url,
  'seed'
FROM (
  VALUES
    ('REUTERS', 'Reuters', 'MAINSTREAM', 'PRIMARY', 'GLOBAL', 'ONLINE', 'COMMERCIAL', 'https://www.reuters.com'),
    ('LLOYDS', 'Lloyd''s List', 'SPECIALIZED', 'ANALYSIS', 'GLOBAL', 'ONLINE', 'COMMERCIAL', 'https://lloydslist.com')
) AS x(source_code, source_name, tier_code, role_code, coverage_code, channel_code, ownership_code, url)
JOIN media_tier_code_dict mt ON mt.tier_code = x.tier_code
JOIN media_role_code_dict mr ON mr.role_code = x.role_code
JOIN media_coverage_code_dict mc ON mc.coverage_code = x.coverage_code
JOIN media_channel_code_dict mch ON mch.channel_code = x.channel_code
JOIN media_ownership_code_dict mo ON mo.ownership_code = x.ownership_code
ON CONFLICT (source_code) DO UPDATE
SET source_name = EXCLUDED.source_name,
    tier_id = EXCLUDED.tier_id,
    role_id = EXCLUDED.role_id,
    coverage_id = EXCLUDED.coverage_id,
    channel_id = EXCLUDED.channel_id,
    ownership_id = EXCLUDED.ownership_id,
    url = EXCLUDED.url,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_data_source_access (source_id, access_l2_id, auth_status, is_purchased, auth_start_time, auth_end_time, access_account, access_password, remark)
SELECT s.id, a.id, '已获取', 1, NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days', 'demo_user', 'demo_pass', 'seed'
FROM media_data_source_dict s
JOIN media_access_l2_code_dict a ON a.access_l2_code = 'PAID_API'
WHERE s.source_code = 'LLOYDS'
  AND NOT EXISTS (
    SELECT 1 FROM media_data_source_access e
    WHERE e.source_id = s.id AND e.access_l2_id = a.id
  );

INSERT INTO media_domain_focus_l1_code_dict (domain_focus_l1_code, domain_focus_l1_name, remark)
VALUES
  ('SUPPLY_CHAIN', '供应链', 'seed'),
  ('LABOR', '劳资关系', 'seed')
ON CONFLICT (domain_focus_l1_code) DO UPDATE
SET domain_focus_l1_name = EXCLUDED.domain_focus_l1_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_domain_focus_l2_code_dict (domain_focus_l1_id, domain_focus_l2_code, domain_focus_l2_name, domain_focus_l2_desc, keywords_example, remark)
SELECT l1.id, x.code, x.name, x.descr, x.kw, 'seed'
FROM (
  VALUES
    ('SUPPLY_CHAIN', 'SC_PORT', '港口中断', '港口罢工和拥堵', '港口,码头,拥堵'),
    ('SUPPLY_CHAIN', 'SC_LOGISTICS', '物流延误', '运输延误和绕行', '航线,绕行,延误'),
    ('LABOR', 'LB_STRIKE', '工人罢工', '劳资冲突', '罢工,停工,谈判')
) AS x(l1_code, code, name, descr, kw)
JOIN media_domain_focus_l1_code_dict l1 ON l1.domain_focus_l1_code = x.l1_code
ON CONFLICT (domain_focus_l2_code) DO UPDATE
SET domain_focus_l1_id = EXCLUDED.domain_focus_l1_id,
    domain_focus_l2_name = EXCLUDED.domain_focus_l2_name,
    domain_focus_l2_desc = EXCLUDED.domain_focus_l2_desc,
    keywords_example = EXCLUDED.keywords_example,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_text_content_type_code_dict (content_type_code, content_type_name, definition, remark)
VALUES
  ('NEWS', '新闻', '新闻报道', 'seed'),
  ('ANALYSIS', '分析', '专家分析', 'seed')
ON CONFLICT (content_type_code) DO UPDATE
SET content_type_name = EXCLUDED.content_type_name,
    definition = EXCLUDED.definition,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_factuality_code_dict (factuality_code, factuality_name, definition, usage_suggestion, remark)
VALUES
  ('VERIFIED', '已验证', '多方核验', '可用于自动告警', 'seed'),
  ('PROBABLE', '较可信', '单方来源待核验', '建议人工复核', 'seed')
ON CONFLICT (factuality_code) DO UPDATE
SET factuality_name = EXCLUDED.factuality_name,
    definition = EXCLUDED.definition,
    usage_suggestion = EXCLUDED.usage_suggestion,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_polarity_code_dict (polarity_code, polarity_name, definition, remark)
VALUES
  ('NEGATIVE', '负面', '风险偏负面', 'seed'),
  ('NEUTRAL', '中性', '中性事实描述', 'seed')
ON CONFLICT (polarity_code) DO UPDATE
SET polarity_name = EXCLUDED.polarity_name,
    definition = EXCLUDED.definition,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_emotion_code_dict (emotion_code, emotion_name, definition, common_triggers, remark)
VALUES
  ('ALERT', '警惕', '需要关注', '风险升级', 'seed'),
  ('ANXIETY', '焦虑', '不确定性较高', '延误预期', 'seed')
ON CONFLICT (emotion_code) DO UPDATE
SET emotion_name = EXCLUDED.emotion_name,
    definition = EXCLUDED.definition,
    common_triggers = EXCLUDED.common_triggers,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO media_text_category_dict (category_code, category_name, domain_focus_l2_id, content_type_id, factuality_id, polarity_id, emotion_id, remark)
SELECT
  x.category_code,
  x.category_name,
  l2.id,
  ct.id,
  fa.id,
  po.id,
  em.id,
  'seed'
FROM (
  VALUES
    ('CAT_PORT_ALERT', '港口预警类', 'SC_PORT', 'NEWS', 'VERIFIED', 'NEGATIVE', 'ALERT'),
    ('CAT_LOGI_DELAY', '物流延误类', 'SC_LOGISTICS', 'ANALYSIS', 'PROBABLE', 'NEUTRAL', 'ANXIETY')
) AS x(category_code, category_name, l2_code, ct_code, fa_code, po_code, em_code)
JOIN media_domain_focus_l2_code_dict l2 ON l2.domain_focus_l2_code = x.l2_code
JOIN media_text_content_type_code_dict ct ON ct.content_type_code = x.ct_code
JOIN media_factuality_code_dict fa ON fa.factuality_code = x.fa_code
JOIN media_polarity_code_dict po ON po.polarity_code = x.po_code
JOIN media_emotion_code_dict em ON em.emotion_code = x.em_code
ON CONFLICT (category_code) DO UPDATE
SET category_name = EXCLUDED.category_name,
    domain_focus_l2_id = EXCLUDED.domain_focus_l2_id,
    content_type_id = EXCLUDED.content_type_id,
    factuality_id = EXCLUDED.factuality_id,
    polarity_id = EXCLUDED.polarity_id,
    emotion_id = EXCLUDED.emotion_id,
    remark = EXCLUDED.remark,
    update_time = NOW();

-- ================================
-- Geography + transport
-- ================================
INSERT INTO un_region_dict (region_code, region_name, remark)
VALUES
  ('142', '亚洲', 'seed'),
  ('150', '欧洲', 'seed'),
  ('145', '西亚', 'seed')
ON CONFLICT (region_code) DO UPDATE
SET region_name = EXCLUDED.region_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO un_subregion_dict (region_id, subregion_code, subregion_name, remark)
SELECT r.id, x.subregion_code, x.subregion_name, 'seed'
FROM (
  VALUES
    ('142', '030', '东亚'),
    ('142', '035', '东南亚'),
    ('150', '155', '西欧'),
    ('145', '145', '西亚')
) AS x(region_code, subregion_code, subregion_name)
JOIN un_region_dict r ON r.region_code = x.region_code
ON CONFLICT (subregion_code) DO UPDATE
SET region_id = EXCLUDED.region_id,
    subregion_name = EXCLUDED.subregion_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO country_code_dict (subregion_id, iso2_code, iso3_code, m49_code, country_name)
SELECT s.id, x.iso2, x.iso3, x.m49, x.name
FROM (
  VALUES
    ('030', 'CN', 'CHN', 156, '中国'),
    ('035', 'SG', 'SGP', 702, '新加坡'),
    ('155', 'NL', 'NLD', 528, '荷兰'),
    ('145', 'IR', 'IRN', 364, '伊朗'),
    ('145', 'OM', 'OMN', 512, '阿曼')
) AS x(subregion_code, iso2, iso3, m49, name)
JOIN un_subregion_dict s ON s.subregion_code = x.subregion_code
ON CONFLICT (iso2_code) DO UPDATE
SET subregion_id = EXCLUDED.subregion_id,
    iso3_code = EXCLUDED.iso3_code,
    m49_code = EXCLUDED.m49_code,
    country_name = EXCLUDED.country_name;

INSERT INTO locode_point_dict (
  country_id,
  locode_country,
  locode_place,
  locode_code,
  longitude,
  latitude,
  port,
  rail,
  road,
  airport,
  postal,
  inland_waterway,
  terminal,
  fixed_transport
)
SELECT c.id, x.locode_country, x.locode_place, x.locode_code, x.lng, x.lat, x.port, x.rail, x.road, x.airport, x.postal, x.inland_waterway, x.terminal, x.fixed_transport
FROM (
  VALUES
    ('CN', 'CN', 'SHA', 'CNSHA', 121.4737, 31.2304, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE),
    ('SG', 'SG', 'SIN', 'SGSIN', 103.8198, 1.3521, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE),
    ('NL', 'NL', 'RTM', 'NLRTM', 4.4792, 51.9244, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE),
    ('IR', 'IR', 'BAH', 'IRBAH', 52.5406, 26.1393, TRUE, FALSE, TRUE, TRUE, FALSE, TRUE, TRUE, FALSE),
    ('OM', 'OM', 'MSH', 'OMMSH', 58.5401, 23.6100, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE)
) AS x(iso2, locode_country, locode_place, locode_code, lng, lat, port, rail, road, airport, postal, inland_waterway, terminal, fixed_transport)
JOIN country_code_dict c ON c.iso2_code = x.iso2
ON CONFLICT (locode_code) DO UPDATE
SET country_id = EXCLUDED.country_id,
    longitude = EXCLUDED.longitude,
    latitude = EXCLUDED.latitude,
    port = EXCLUDED.port,
    rail = EXCLUDED.rail,
    road = EXCLUDED.road,
    airport = EXCLUDED.airport,
    postal = EXCLUDED.postal,
    inland_waterway = EXCLUDED.inland_waterway,
    terminal = EXCLUDED.terminal,
    fixed_transport = EXCLUDED.fixed_transport;

INSERT INTO transport_type_dict (transport_type_code, transport_type_name)
VALUES
  ('SEA', '海运'),
  ('AIR', '空运'),
  ('ROAD', '公路')
ON CONFLICT (transport_type_code) DO UPDATE
SET transport_type_name = EXCLUDED.transport_type_name;

INSERT INTO transport_route_dict (route_code, route_name, start_point_id, end_point_id, transport_type_id)
SELECT x.route_code, x.route_name, lp1.id, lp2.id, tt.id
FROM (
  VALUES
    ('SEA-CNSHA-SGSIN', '上海-新加坡海运', 'CNSHA', 'SGSIN', 'SEA'),
    ('SEA-SGSIN-NLRTM', '新加坡-鹿特丹海运', 'SGSIN', 'NLRTM', 'SEA'),
    ('SEA-IRBAH-OMMSH', '霍尔木兹海峡：伊朗-阿曼通道', 'IRBAH', 'OMMSH', 'SEA')
) AS x(route_code, route_name, start_loc, end_loc, transport_code)
JOIN locode_point_dict lp1 ON lp1.locode_code = x.start_loc
JOIN locode_point_dict lp2 ON lp2.locode_code = x.end_loc
JOIN transport_type_dict tt ON tt.transport_type_code = x.transport_code
ON CONFLICT (route_code) DO UPDATE
SET route_name = EXCLUDED.route_name,
    start_point_id = EXCLUDED.start_point_id,
    end_point_id = EXCLUDED.end_point_id,
    transport_type_id = EXCLUDED.transport_type_id;

INSERT INTO country_transport_route_dict (route_code, start_country_id, end_country_id, transport_type_id, edge_count, weight, is_directed, is_active)
SELECT
  x.route_code,
  c1.id,
  c2.id,
  tt.id,
  x.edge_count,
  x.weight,
  1,
  1
FROM (
  VALUES
    ('CN-SG-SEA', 'CN', 'SG', 'SEA', 12, 0.87),
    ('SG-NL-SEA', 'SG', 'NL', 'SEA', 9, 0.76),
    ('IR-OM-SEA', 'IR', 'OM', 'SEA', 1, 0.95)
) AS x(route_code, c1, c2, transport_code, edge_count, weight)
JOIN country_code_dict c1 ON c1.iso2_code = x.c1
JOIN country_code_dict c2 ON c2.iso2_code = x.c2
JOIN transport_type_dict tt ON tt.transport_type_code = x.transport_code
ON CONFLICT (route_code) DO UPDATE
SET start_country_id = EXCLUDED.start_country_id,
    end_country_id = EXCLUDED.end_country_id,
    transport_type_id = EXCLUDED.transport_type_id,
    edge_count = EXCLUDED.edge_count,
    weight = EXCLUDED.weight,
    is_directed = EXCLUDED.is_directed,
    is_active = EXCLUDED.is_active;

-- ================================
-- Risk dictionaries
-- ================================
INSERT INTO risk_tier1_type_dict (risk_tier1_type_code, risk_tier1_type_name, remark)
VALUES
  ('LABOR', '劳资风险', 'seed'),
  ('NATURE', '自然灾害', 'seed'),
  ('LOGISTICS', '物流中断', 'seed'),
  ('GEOPOLITICS', '地缘政治风险', 'seed')
ON CONFLICT (risk_tier1_type_code) DO UPDATE
SET risk_tier1_type_name = EXCLUDED.risk_tier1_type_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO risk_tier2_type_dict (risk_tier1_type_id, risk_tier2_type_code, risk_tier2_type_name, risk_level, remark)
SELECT r1.id, x.code, x.name, x.level, 'seed'
FROM (
  VALUES
    ('LABOR', 'PORT_STRIKE', '港口罢工', 4),
    ('NATURE', 'TYPHOON', '台风影响', 5),
    ('LOGISTICS', 'ROUTE_DELAY', '航线延误', 3),
    ('GEOPOLITICS', 'STRAIT_TENSION', '海峡地缘政治紧张', 5),
    ('GEOPOLITICS', 'SANCTIONS', '国际制裁', 4)
) AS x(t1_code, code, name, level)
JOIN risk_tier1_type_dict r1 ON r1.risk_tier1_type_code = x.t1_code
ON CONFLICT (risk_tier2_type_code) DO UPDATE
SET risk_tier1_type_id = EXCLUDED.risk_tier1_type_id,
    risk_tier2_type_name = EXCLUDED.risk_tier2_type_name,
    risk_level = EXCLUDED.risk_level,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO natural_disaster_tier1_dict (tier1_code, tier1_name, remark)
VALUES
  ('01', '气象水文灾害', 'seed'),
  ('02', '地质灾害', 'seed')
ON CONFLICT (tier1_code) DO UPDATE
SET tier1_name = EXCLUDED.tier1_name,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO natural_disaster_tier2_dict (tier2_code, tier2_name, tier1_id, remark)
SELECT x.code, x.name, t1.id, 'seed'
FROM (
  VALUES
    ('0102', '台风', '01'),
    ('0103', '洪水', '01'),
    ('0201', '地震', '02')
) AS x(code, name, t1_code)
JOIN natural_disaster_tier1_dict t1 ON t1.tier1_code = x.t1_code
ON CONFLICT (tier2_code) DO UPDATE
SET tier2_name = EXCLUDED.tier2_name,
    tier1_id = EXCLUDED.tier1_id,
    remark = EXCLUDED.remark,
    update_time = NOW();

-- ================================
-- event_main + relation tables
-- ================================
INSERT INTO event_main (
  event_id,
  text_category_id,
  event_title,
  event_description,
  occur_time,
  source_id,
  supplychain_tier2_id,
  domain_focus_l2_id,
  remark
)
SELECT
  x.event_id,
  tc.id,
  x.event_title,
  x.event_description,
  x.occur_time,
  src.id,
  sc2.id,
  l2.id,
  'seed'
FROM (
  VALUES
    ('EVT-SEED-001', 'CAT_PORT_ALERT', '鹿特丹港口罢工升级', '欧洲港口工会升级罢工，影响干线船期。', NOW() - INTERVAL '2 days', 'REUTERS', 'SC02-HUB', 'SC_PORT'),
    ('EVT-SEED-002', 'CAT_LOGI_DELAY', '东南亚台风导致航线绕行', '台风导致多条航线调整，预计延误48小时。', NOW() - INTERVAL '1 day', 'LLOYDS', 'SC03-CDC', 'SC_LOGISTICS'),
    ('EVT-SEED-003', 'CAT_PORT_ALERT', '霍尔木兹海峡地缘政治紧张升级', '伊朗与周边国家关系恶化，霍尔木兹海峡全球20%石油运输面临中断风险。船队保险费率上升30%。', NOW() - INTERVAL '12 hours', 'REUTERS', 'SC02-HUB', 'SC_PORT')
) AS x(event_id, category_code, event_title, event_description, occur_time, source_code, sc2_code, l2_code)
JOIN media_text_category_dict tc ON tc.category_code = x.category_code
JOIN media_data_source_dict src ON src.source_code = x.source_code
JOIN supplychain_tier2_dict sc2 ON sc2.tier2_code = x.sc2_code
JOIN media_domain_focus_l2_code_dict l2 ON l2.domain_focus_l2_code = x.l2_code
ON CONFLICT (event_id) DO UPDATE
SET text_category_id = EXCLUDED.text_category_id,
    event_title = EXCLUDED.event_title,
    event_description = EXCLUDED.event_description,
    occur_time = EXCLUDED.occur_time,
    source_id = EXCLUDED.source_id,
    supplychain_tier2_id = EXCLUDED.supplychain_tier2_id,
    domain_focus_l2_id = EXCLUDED.domain_focus_l2_id,
    remark = EXCLUDED.remark,
    update_time = NOW();

INSERT INTO event_risk_relation (event_main_id, tier2_risk_type_id, remark)
SELECT em.id, r2.id, 'seed'
FROM event_main em
JOIN risk_tier2_type_dict r2 ON (
  (em.event_id = 'EVT-SEED-001' AND r2.risk_tier2_type_code = 'PORT_STRIKE')
  OR (em.event_id = 'EVT-SEED-002' AND r2.risk_tier2_type_code IN ('TYPHOON', 'ROUTE_DELAY'))
  OR (em.event_id = 'EVT-SEED-003' AND r2.risk_tier2_type_code IN ('STRAIT_TENSION', 'SANCTIONS'))
)
WHERE NOT EXISTS (
  SELECT 1 FROM event_risk_relation e
  WHERE e.event_main_id = em.id AND e.tier2_risk_type_id = r2.id
);

INSERT INTO event_product_relation (event_main_id, product_tier3_id, relation_type_code, remark)
SELECT em.id, p3.id, 'affected', 'seed'
FROM event_main em
JOIN product_tier3_code_dict p3 ON (
  (em.event_id IN ('EVT-SEED-001', 'EVT-SEED-002') AND p3.tier3_code IN ('850760', '870899'))
  OR (em.event_id = 'EVT-SEED-003' AND p3.tier3_code IN ('270900', '271100'))
)
WHERE NOT EXISTS (
    SELECT 1 FROM event_product_relation e
    WHERE e.event_main_id = em.id AND e.product_tier3_id = p3.id
  );

INSERT INTO event_enterprise_relation (event_main_id, enterprise_id, relation_type_code, remark)
SELECT em.id, ent.id, 'affected', 'seed'
FROM event_main em
JOIN enterprise_dict ent ON ent.enterprise_code IN ('91310000A100000001', '91310000A100000002')
WHERE em.event_id IN ('EVT-SEED-001', 'EVT-SEED-002')
  AND NOT EXISTS (
    SELECT 1 FROM event_enterprise_relation e
    WHERE e.event_main_id = em.id AND e.enterprise_id = ent.id
  );

INSERT INTO event_geo_relation (event_main_id, locode_point_id, relation_type_code, remark)
SELECT em.id, lp.id, '发生地', 'seed'
FROM event_main em
JOIN locode_point_dict lp ON (
  (em.event_id = 'EVT-SEED-001' AND lp.locode_code = 'NLRTM')
  OR (em.event_id = 'EVT-SEED-002' AND lp.locode_code = 'SGSIN')
  OR (em.event_id = 'EVT-SEED-003' AND lp.locode_code IN ('IRBAH', 'OMMSH'))
)
WHERE NOT EXISTS (
  SELECT 1 FROM event_geo_relation e
  WHERE e.event_main_id = em.id AND e.locode_point_id = lp.id
);

-- ================================
-- Product portrait (new tables)
-- ================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_portrait_config')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_portrait_rows')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_portrait_versions') THEN

    INSERT INTO product_portrait_config (
      organization_id,
      user_id,
      focus_industries,
      risk_sensitivity,
      watch_regions,
      min_confidence,
      notify_by_email,
      track_supply_stages
    )
    SELECT
      '00000000-0000-0000-0000-000000000001',
      ua.id::text,
      ARRAY['消费电子', '新能源']::text[],
      'high',
      ARRAY['亚太', '欧洲']::text[],
      68,
      TRUE,
      ARRAY['生产制造', '港口码头', '仓储配送']::text[]
    FROM user_account ua
    WHERE ua.username = 'admin'
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET focus_industries = EXCLUDED.focus_industries,
        risk_sensitivity = EXCLUDED.risk_sensitivity,
        watch_regions = EXCLUDED.watch_regions,
        min_confidence = EXCLUDED.min_confidence,
        notify_by_email = EXCLUDED.notify_by_email,
        track_supply_stages = EXCLUDED.track_supply_stages,
        updated_at = NOW();

    INSERT INTO product_portrait_rows (
      organization_id,
      user_id,
      product_line,
      coding_system,
      code_value,
      keywords,
      focus_regions,
      focus_stages
    )
    SELECT
      '00000000-0000-0000-0000-000000000001',
      ua.id::text,
      x.product_line,
      x.coding_system,
      x.code_value,
      x.keywords,
      x.focus_regions,
      x.focus_stages
    FROM user_account ua
    CROSS JOIN (
      VALUES
        ('消费电子', 'HS', '854231', ARRAY['芯片','晶圆']::text[], ARRAY['亚太','欧洲']::text[], ARRAY['生产制造','港口码头']::text[]),
        ('新能源', 'HS', '850760', ARRAY['电芯','锂电池']::text[], ARRAY['东南亚','欧洲']::text[], ARRAY['仓储配送','末端派送']::text[])
    ) AS x(product_line, coding_system, code_value, keywords, focus_regions, focus_stages)
    WHERE ua.username = 'admin'
    ON CONFLICT (organization_id, user_id, product_line, coding_system, code_value) DO UPDATE
    SET keywords = EXCLUDED.keywords,
        focus_regions = EXCLUDED.focus_regions,
        focus_stages = EXCLUDED.focus_stages,
        updated_at = NOW();

    INSERT INTO product_portrait_versions (
      organization_id,
      user_id,
      version_no,
      row_count,
      rows_snapshot
    )
    SELECT
      '00000000-0000-0000-0000-000000000001',
      ua.id::text,
      1,
      2,
      '[{"productLine":"消费电子","codingSystem":"HS","codeValue":"854231","keywords":["芯片","晶圆"],"focusRegions":["亚太","欧洲"],"focusStages":["生产制造","港口码头"]},{"productLine":"新能源","codingSystem":"HS","codeValue":"850760","keywords":["电芯","锂电池"],"focusRegions":["东南亚","欧洲"],"focusStages":["仓储配送","末端派送"]}]'::jsonb
    FROM user_account ua
    WHERE ua.username = 'admin'
    ON CONFLICT (organization_id, user_id, version_no) DO UPDATE
    SET row_count = EXCLUDED.row_count,
        rows_snapshot = EXCLUDED.rows_snapshot,
        created_at = NOW();
  END IF;
END
$$;

-- ================================
-- Optional operational tables used by current APIs
-- Seed only when those tables exist.
-- ================================
DO $$
DECLARE
  subscriptions_user_id_type text;
  user_account_id_type text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    INSERT INTO products (organization_id, name, hs_code, gpc_code, category, description, supply_chain_stage)
    VALUES
      ('00000000-0000-0000-0000-000000000001', '动力电池模组', '850760', '10005213', '新能源', '演示产品', '生产制造'),
      ('00000000-0000-0000-0000-000000000001', '车规级MCU', '854231', '10003591', '消费电子', '演示产品', '港口码头')
    ON CONFLICT DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    SELECT c.data_type
    INTO subscriptions_user_id_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'subscriptions'
      AND c.column_name = 'user_id'
    LIMIT 1;

    SELECT c.data_type
    INTO user_account_id_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'user_account'
      AND c.column_name = 'id'
    LIMIT 1;

    IF subscriptions_user_id_type = 'uuid' AND user_account_id_type = 'uuid' THEN
      INSERT INTO subscriptions (user_id, organization_id, subscription_type, filter_value, is_active, notify_channel)
      SELECT ua.id, '00000000-0000-0000-0000-000000000001', 'risk_type', 'PORT_STRIKE', TRUE, 'in_app'
      FROM user_account ua
      WHERE ua.username = 'admin'
      ON CONFLICT DO NOTHING;
    ELSIF subscriptions_user_id_type = 'bigint' THEN
      INSERT INTO subscriptions (user_id, organization_id, subscription_type, filter_value, is_active, notify_channel)
      SELECT ua.id, '00000000-0000-0000-0000-000000000001', 'risk_type', 'PORT_STRIKE', TRUE, 'in_app'
      FROM user_account ua
      WHERE ua.username = 'admin'
      ON CONFLICT DO NOTHING;
    ELSIF subscriptions_user_id_type IN ('character varying', 'text') THEN
      INSERT INTO subscriptions (user_id, organization_id, subscription_type, filter_value, is_active, notify_channel)
      SELECT ua.id::text, '00000000-0000-0000-0000-000000000001', 'risk_type', 'PORT_STRIKE', TRUE, 'in_app'
      FROM user_account ua
      WHERE ua.username = 'admin'
      ON CONFLICT DO NOTHING;
    ELSE
      RAISE NOTICE 'Skip seeding subscriptions: unsupported user_id type % (user_account.id type %).', subscriptions_user_id_type, user_account_id_type;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    INSERT INTO events (organization_id, title, description, severity, confidence_score, occurred_at, created_at, updated_at)
    SELECT
      '00000000-0000-0000-0000-000000000001',
      x.title,
      x.description,
      x.severity,
      x.confidence,
      x.occurred_at,
      NOW(),
      NOW()
    FROM (
      VALUES
        ('鹿特丹港工会再度罢工', '欧洲主航线出现装卸中断，预计延误72小时。', 'critical', 92, NOW() - INTERVAL '6 hours'),
        ('新加坡港台风后拥堵', '拥堵指数升高，部分航线绕行。', 'warning', 84, NOW() - INTERVAL '14 hours'),
        ('东亚芯片供应偏紧', '上游产线检修导致短期供给波动。', 'info', 73, NOW() - INTERVAL '1 day'),
        ('霍尔木兹海峡地缘政治风险升级', '中东局势加剧，伊朗宣布限制油气出口。全球20%的石油经霍尔木兹海峡，船队保险费率上升30%。建议启动替代供应。', 'critical', 95, NOW() - INTERVAL '6 hours')
    ) AS x(title, description, severity, confidence, occurred_at)
    WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.title = x.title AND e.organization_id = '00000000-0000-0000-0000-000000000001');

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_locations') THEN
      INSERT INTO event_locations (event_id, location_name, country_code, latitude, longitude, region, supply_chain_node)
      SELECT e.id, x.location_name, x.country_code, x.lat, x.lng, x.region, x.node
      FROM (
        VALUES
          ('鹿特丹港工会再度罢工', '鹿特丹港', 'NL', 51.9244, 4.4792, '欧洲', '港口码头'),
          ('新加坡港台风后拥堵', '新加坡港', 'SG', 1.3521, 103.8198, '亚太', '港口码头'),
          ('东亚芯片供应偏紧', '上海', 'CN', 31.2304, 121.4737, '亚太', '生产制造'),
          ('霍尔木兹海峡地缘政治风险升级', '霍尔木兹海峡', 'IR', 26.5667, 56.2667, '中东', '港口码头'),
          ('霍尔木兹海峡地缘政治风险升级', '阿曼马斯卡特', 'OM', 23.6100, 58.5401, '中东', '港口码头')
      ) AS x(title, location_name, country_code, lat, lng, region, node)
      JOIN events e ON e.title = x.title AND e.organization_id = '00000000-0000-0000-0000-000000000001'
      WHERE NOT EXISTS (
        SELECT 1 FROM event_locations el WHERE el.event_id = e.id AND el.location_name = x.location_name
      );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_impacts') THEN
      INSERT INTO event_impacts (event_id, impact_type, estimated_impact, affected_area, supply_chain_stage, recovery_days)
      SELECT e.id, x.impact_type, x.estimated_impact, x.affected_area, x.supply_chain_stage, x.recovery_days
      FROM (
        VALUES
          ('鹿特丹港工会再度罢工', 'target', '延误72小时', '欧洲', '港口码头', 4),
          ('鹿特丹港工会再度罢工', 'event_type', '港口劳资冲突', '欧洲', '港口码头', 4),
          ('鹿特丹港工会再度罢工', 'product', '锂离子蓄电池交付延迟', '锂离子蓄电池', '港口码头', 5),
          ('鹿特丹港工会再度罢工', 'industry', '汽车制造排产扰动', '汽车制造', '生产制造', 6),
          ('新加坡港台风后拥堵', 'target', '延误48小时', '亚太', '港口码头', 3),
          ('新加坡港台风后拥堵', 'event_type', '自然灾害', '亚太', '港口码头', 3),
          ('新加坡港台风后拥堵', 'product', '车辆其他零件到货延误', '车辆其他零件', '港口码头', 4),
          ('新加坡港台风后拥堵', 'industry', '物流仓储吞吐下降', '物流仓储', '仓储配送', 4),
          ('东亚芯片供应偏紧', 'target', '交付波动', '亚太', '生产制造', 5),
          ('东亚芯片供应偏紧', 'event_type', '供应短缺', '亚太', '生产制造', 5),
          ('东亚芯片供应偏紧', 'product', '处理器及控制器供给紧张', '处理器及控制器', '生产制造', 6),
          ('东亚芯片供应偏紧', 'industry', '消费电子产能波动', '消费电子', '生产制造', 6),
          ('霍尔木兹海峡地缘政治风险升级', 'target', '全球油气供应中断20%', '全球', '港口码头', 30),
          ('霍尔木兹海峡地缘政治风险升级', 'event_type', '地缘政治冲突', '中东', '港口码头', 30),
          ('霍尔木兹海峡地缘政治风险升级', 'target', '原油价格上升45%', '全球', '生产制造', 60),
          ('霍尔木兹海峡地缘政治风险升级', 'event_type', '贸易路线关闭', '全球', '港口码头', 30),
          ('霍尔木兹海峡地缘政治风险升级', 'product', '中东原油供应趋紧', '中东原油', '港口码头', 35),
          ('霍尔木兹海峡地缘政治风险升级', 'industry', '能源化工成本上升', '能源化工', '生产制造', 45),
          ('霍尔木兹海峡地缘政治风险升级', 'industry', '航运物流保费上涨', '航运物流', '港口码头', 40)
      ) AS x(title, impact_type, estimated_impact, affected_area, supply_chain_stage, recovery_days)
      JOIN events e ON e.title = x.title AND e.organization_id = '00000000-0000-0000-0000-000000000001'
      WHERE NOT EXISTS (
        SELECT 1 FROM event_impacts ei
        WHERE ei.event_id = e.id AND ei.impact_type = x.impact_type AND COALESCE(ei.supply_chain_stage, '') = COALESCE(x.supply_chain_stage, '')
      );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alerts') THEN
      INSERT INTO alerts (organization_id, event_id, title, description, severity, alert_type, is_read, triggered_at, created_at)
      SELECT
        '00000000-0000-0000-0000-000000000001',
        e.id,
        x.title,
        x.description,
        x.severity,
        x.alert_type,
        FALSE,
        NOW(),
        NOW()
      FROM (
        VALUES
          ('鹿特丹港工会再度罢工', '高风险预警: 欧洲港口中断', '建议切换备选港口并调整到港窗口。', 'critical', 'new_event'),
          ('新加坡港台风后拥堵', '运营提示: 亚太航线拥堵', '建议提前预订舱位并增加安全库存。', 'warning', 'impact_update'),
          ('霍尔木兹海峡地缘政治紧张升级', '关键预警: 全球能源供应链受威胁', '全球20%石油通过霍尔木兹海峡。建议：1.启动替代能源采购；2.增加库存70天；3.锁定运输费率；4.密切关注地缘政治动向。', 'critical', 'new_event')
      ) AS x(event_title, title, description, severity, alert_type)
      JOIN events e ON e.title = x.event_title AND e.organization_id = '00000000-0000-0000-0000-000000000001'
      WHERE NOT EXISTS (
        SELECT 1 FROM alerts a WHERE a.organization_id = '00000000-0000-0000-0000-000000000001' AND a.title = x.title
      );
    END IF;
  END IF;
END
$$;

COMMIT;
