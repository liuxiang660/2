-- Patch seed for EventDetail impact dimensions
-- Purpose: ensure product / region / industry impacts are available for existing events
-- Safe to run repeatedly

BEGIN;

-- 1) Ensure representative locations exist for key events
INSERT INTO event_locations (event_id, location_name, country_code, region, supply_chain_node)
SELECT e.id, x.location_name, x.country_code, x.region, x.supply_chain_node
FROM (
  VALUES
    ('鹿特丹港工会再度罢工', '鹿特丹港', 'NL', '欧洲', '港口码头'),
    ('新加坡港台风后拥堵', '新加坡港', 'SG', '亚太', '港口码头'),
    ('东亚芯片供应偏紧', '上海', 'CN', '亚太', '生产制造'),
    ('霍尔木兹海峡地缘政治风险升级', '霍尔木兹海峡', 'IR', '中东', '港口码头')
) AS x(title, location_name, country_code, region, supply_chain_node)
JOIN events e ON e.title = x.title
WHERE NOT EXISTS (
  SELECT 1
  FROM event_locations el
  WHERE el.event_id = e.id
    AND el.location_name = x.location_name
);

-- 2) Add impact rows for product / region / industry
INSERT INTO event_impacts (event_id, impact_type, estimated_impact, affected_area, supply_chain_stage, recovery_days)
SELECT e.id, x.impact_type, x.estimated_impact, x.affected_area, x.supply_chain_stage, x.recovery_days
FROM (
  VALUES
    ('鹿特丹港工会再度罢工', 'target', '延误72小时', '欧洲', '港口码头', 4),
    ('鹿特丹港工会再度罢工', 'product', '锂离子蓄电池交付延迟', '锂离子蓄电池', '港口码头', 5),
    ('鹿特丹港工会再度罢工', 'product', '车辆其他零件补货窗口拉长', '车辆其他零件', '港口码头', 5),
    ('鹿特丹港工会再度罢工', 'industry', '汽车制造排产扰动', '汽车制造', '生产制造', 6),
    ('鹿特丹港工会再度罢工', 'industry', '港口集疏运压力上升', '航运物流', '港口码头', 4),
    ('鹿特丹港工会再度罢工', 'region', '欧洲北部港口联动拥堵', '欧洲', '港口码头', 4),

    ('新加坡港台风后拥堵', 'target', '延误48小时', '亚太', '港口码头', 3),
    ('新加坡港台风后拥堵', 'product', '车辆其他零件到货延误', '车辆其他零件', '港口码头', 4),
    ('新加坡港台风后拥堵', 'product', '电子元件转运周期拉长', '处理器及控制器', '港口码头', 4),
    ('新加坡港台风后拥堵', 'industry', '物流仓储吞吐下降', '物流仓储', '仓储配送', 4),
    ('新加坡港台风后拥堵', 'industry', '跨境电商履约时效波动', '零售电商', '仓储配送', 4),
    ('新加坡港台风后拥堵', 'region', '东南亚中转链路受压', '亚太', '港口码头', 3),

    ('东亚芯片供应偏紧', 'target', '交付波动', '亚太', '生产制造', 5),
    ('东亚芯片供应偏紧', 'product', '处理器及控制器供给紧张', '处理器及控制器', '生产制造', 6),
    ('东亚芯片供应偏紧', 'product', '汽车电子芯片交付排队', '车辆电子控制单元', '生产制造', 7),
    ('东亚芯片供应偏紧', 'industry', '消费电子产能波动', '消费电子', '生产制造', 6),
    ('东亚芯片供应偏紧', 'industry', '汽车电子备货风险抬升', '汽车零部件', '生产制造', 7),
    ('东亚芯片供应偏紧', 'region', '东亚晶圆代工产能紧张', '亚太', '生产制造', 6),

    ('霍尔木兹海峡地缘政治风险升级', 'target', '全球油气供应中断20%', '全球', '港口码头', 30),
    ('霍尔木兹海峡地缘政治风险升级', 'product', '中东原油供应趋紧', '中东原油', '港口码头', 35),
    ('霍尔木兹海峡地缘政治风险升级', 'product', '液化天然气到岸成本上行', '液化天然气', '港口码头', 35),
    ('霍尔木兹海峡地缘政治风险升级', 'industry', '能源化工成本上升', '能源化工', '生产制造', 45),
    ('霍尔木兹海峡地缘政治风险升级', 'industry', '远洋运输保费提升', '航运物流', '港口码头', 40),
    ('霍尔木兹海峡地缘政治风险升级', 'region', '中东航线通行不确定性上升', '中东', '港口码头', 30)
) AS x(title, impact_type, estimated_impact, affected_area, supply_chain_stage, recovery_days)
JOIN events e ON e.title = x.title
WHERE NOT EXISTS (
  SELECT 1
  FROM event_impacts ei
  WHERE ei.event_id = e.id
    AND ei.impact_type = x.impact_type
    AND COALESCE(ei.affected_area, '') = COALESCE(x.affected_area, '')
    AND COALESCE(ei.supply_chain_stage, '') = COALESCE(x.supply_chain_stage, '')
);

-- 3) Fill missing cover images for event library cards (data-only update)
--    Compatible with different DB column names: cover_image / cover_url / image_url / image
DO $$
DECLARE
  v_col TEXT;
BEGIN
  SELECT c.column_name
  INTO v_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND c.column_name IN ('cover_image', 'cover_url', 'image_url', 'image')
  ORDER BY CASE c.column_name
    WHEN 'cover_image' THEN 1
    WHEN 'cover_url' THEN 2
    WHEN 'image_url' THEN 3
    WHEN 'image' THEN 4
    ELSE 99
  END
  LIMIT 1;

  IF v_col IS NOT NULL THEN
    EXECUTE format($SQL$
      UPDATE events
      SET %I = CASE
        WHEN title = '鹿特丹港工会再度罢工' THEN 'https://dummyimage.com/1280x720/0b3d91/ffffff.png&text=Rotterdam+Port+Strike'
        WHEN title = '新加坡港台风后拥堵' THEN 'https://dummyimage.com/1280x720/0f766e/ffffff.png&text=Singapore+Port+Typhoon+Congestion'
        WHEN title = '东亚芯片供应偏紧' THEN 'https://dummyimage.com/1280x720/312e81/ffffff.png&text=East+Asia+Chip+Supply+Tightness'
        WHEN title = '霍尔木兹海峡地缘政治风险升级' THEN 'https://q5.itc.cn/q_70/images03/20260331/0847f53a73a44eeda94453cf9c78ed6f.jpeg'
        ELSE %I
      END
      WHERE (
        %I IS NULL
        OR trim(%I) = ''
        OR %I LIKE '/event-images/%%'
        OR %I LIKE 'https://source.unsplash.com/%%'
        OR %I LIKE 'https://images.unsplash.com/%%'
        OR %I LIKE 'https://commons.wikimedia.org/%%'
        OR %I LIKE 'https://upload.wikimedia.org/%%'
        OR %I LIKE 'https://picsum.photos/%%'
        OR (
          title = '霍尔木兹海峡地缘政治风险升级'
          AND %I LIKE 'https://dummyimage.com/%%'
        )
      )
        AND title IN (
          '鹿特丹港工会再度罢工',
          '新加坡港台风后拥堵',
          '东亚芯片供应偏紧',
          '霍尔木兹海峡地缘政治风险升级'
        )
    $SQL$, v_col, v_col, v_col, v_col, v_col, v_col);
  END IF;
END
$$;

COMMIT;
