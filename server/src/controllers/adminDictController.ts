import { Request, Response } from 'express';
import { supabase } from '../utils/db';
import { AuthRequest } from '../types';

/**
 * 通用数据字典CRUD控制器
 * 支持多个数据字典表的操作
 */

// 定义支持的字典表和它们的字段
const DICTIONARY_TABLES: Record<string, any> = {
  product_tier1: {
    table: 'product_tier1_code_dict',
    fields: ['tier1_code', 'tier1_name', 'remark'],
    keyField: 'tier1_code'
  },
  product_tier2: {
    table: 'product_tier2_code_dict',
    fields: ['tier2_code', 'tier2_name', 'tier1_id', 'remark'],
    keyField: 'tier2_code'
  },
  product_tier3: {
    table: 'product_tier3_code_dict',
    fields: ['tier3_code', 'tier3_name', 'tier2_id', 'remark'],
    keyField: 'tier3_code'
  },
  risk_tier1: {
    table: 'risk_tier1_type_dict',
    fields: ['risk_tier1_type_code', 'risk_tier1_type_name', 'remark'],
    keyField: 'risk_tier1_type_code'
  },
  risk_tier2: {
    table: 'risk_tier2_type_dict',
    fields: ['risk_tier2_type_code', 'risk_tier2_type_name', 'risk_tier1_type_id', 'risk_level', 'remark'],
    keyField: 'risk_tier2_type_code'
  },
  natural_disaster_tier1: {
    table: 'natural_disaster_tier1_dict',
    fields: ['tier1_code', 'tier1_name', 'remark'],
    keyField: 'tier1_code'
  },
  natural_disaster_tier2: {
    table: 'natural_disaster_tier2_dict',
    fields: ['tier2_code', 'tier2_name', 'tier1_id', 'remark'],
    keyField: 'tier2_code'
  },
  supplychain_tier1: {
    table: 'supplychain_tier1_dict',
    fields: ['tier1_code', 'tier1_name', 'tier1_name_en', 'sequence_no', 'standard_input', 'standard_output', 'status', 'remark'],
    keyField: 'tier1_code'
  },
  supplychain_tier2: {
    table: 'supplychain_tier2_dict',
    fields: ['tier2_code', 'tier1_id', 'tier2_name', 'tier2_name_en', 'sequence_no', 'input_spec', 'output_spec', 'key_activities', 'trigger_condition', 'status', 'remark'],
    keyField: 'tier2_code'
  },
  enterprise_industry_tier1: {
    table: 'enterprise_industry_tier1_dict',
    fields: ['tier1_code', 'tier1_name', 'is_active', 'remark'],
    keyField: 'tier1_code'
  },
  media_tier: {
    table: 'media_tier_code_dict',
    fields: ['tier_code', 'tier_name', 'remark'],
    keyField: 'tier_code'
  },
  media_role: {
    table: 'media_role_code_dict',
    fields: ['role_code', 'role_name', 'remark'],
    keyField: 'role_code'
  },
  media_domain_focus_l1: {
    table: 'media_domain_focus_l1_code_dict',
    fields: ['domain_focus_l1_code', 'domain_focus_l1_name', 'remark'],
    keyField: 'domain_focus_l1_code'
  },
  media_domain_focus_l2: {
    table: 'media_domain_focus_l2_code_dict',
    fields: ['domain_focus_l1_id', 'domain_focus_l2_code', 'domain_focus_l2_name', 'domain_focus_l2_desc', 'keywords_example', 'remark'],
    keyField: 'domain_focus_l2_code'
  },
  country: {
    table: 'country_code_dict',
    fields: ['iso2_code', 'iso3_code', 'm49_code', 'country_name', 'subregion_id'],
    keyField: 'iso2_code'
  },
  locode_point: {
    table: 'locode_point_dict',
    fields: ['country_id', 'locode_country', 'locode_place', 'locode_code', 'longitude', 'latitude', 'port', 'rail', 'road', 'airport', 'postal', 'inland_waterway', 'terminal', 'fixed_transport'],
    keyField: 'locode_code'
  },
  transport_type: {
    table: 'transport_type_dict',
    fields: ['transport_type_code', 'transport_type_name'],
    keyField: 'transport_type_code'
  }
};

/**
 * 获取指定字典类型的所有数据
 * GET /api/admin/dictionaries/:dictType
 */
export async function getDictionary(req: AuthRequest, res: Response) {
  try {
    const { dictType } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const config = DICTIONARY_TABLES[dictType];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: '无效的字典类型'
      });
    }

    const offset = ((Number(page) - 1) * Number(limit));

    // 查询数据
    const { data, error, count } = await supabase
      .from(config.table)
      .select('*', { count: 'exact' })
      .order('id', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      console.error('Query error:', error);
      return res.status(500).json({
        success: false,
        message: '查询失败'
      });
    }

    return res.json({
      success: true,
      message: '查询成功',
      data: {
        items: data || [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get dictionary error:', error);
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 创建新字典项
 * POST /api/admin/dictionaries/:dictType
 */
export async function createDictionaryItem(req: AuthRequest, res: Response) {
  try {
    const { dictType } = req.params;
    const data = req.body;

    const config = DICTIONARY_TABLES[dictType];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: '无效的字典类型'
      });
    }

    // 验证必需字段
    if (!data[config.keyField]) {
      return res.status(400).json({
        success: false,
        message: `${config.keyField}不能为空`
      });
    }

    // 添加时间戳
    const record = {
      ...data,
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString()
    };

    // 插入数据
    const { data: inserted, error } = await supabase
      .from(config.table)
      .insert([record])
      .select();

    if (error) {
      console.error('Insert error:', error);
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: `${config.keyField}已存在`
        });
      }
      return res.status(500).json({
        success: false,
        message: '创建失败'
      });
    }

    return res.status(201).json({
      success: true,
      message: '创建成功',
      data: inserted?.[0]
    });
  } catch (error) {
    console.error('Create dictionary item error:', error);
    res.status(500).json({
      success: false,
      message: '创建失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 更新字典项
 * PUT /api/admin/dictionaries/:dictType/:id
 */
export async function updateDictionaryItem(req: AuthRequest, res: Response) {
  try {
    const { dictType, id } = req.params;
    const data = req.body;

    const config = DICTIONARY_TABLES[dictType];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: '无效的字典类型'
      });
    }

    // 添加更新时间
    data.update_time = new Date().toISOString();

    // 删除不应修改的字段
    delete data.create_time;
    delete data.id;
    delete data[config.keyField]; // 不允许修改键字段

    // 更新数据
    const { data: updated, error } = await supabase
      .from(config.table)
      .update(data)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Update error:', error);
      return res.status(500).json({
        success: false,
        message: '更新失败'
      });
    }

    if (!updated || updated.length === 0) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }

    return res.json({
      success: true,
      message: '更新成功',
      data: updated[0]
    });
  } catch (error) {
    console.error('Update dictionary item error:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 删除字典项
 * DELETE /api/admin/dictionaries/:dictType/:id
 */
export async function deleteDictionaryItem(req: AuthRequest, res: Response) {
  try {
    const { dictType, id } = req.params;

    const config = DICTIONARY_TABLES[dictType];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: '无效的字典类型'
      });
    }

    // 检查是否有关联的子项
    if (dictType === 'product_tier1') {
      const { count } = await supabase
        .from('product_tier2_code_dict')
        .select('*', { count: 'exact', head: true })
        .eq('tier1_id', id);

      if (count && count > 0) {
        return res.status(409).json({
          success: false,
          message: '存在下级分类，无法删除'
        });
      }
    }

    // 删除数据
    const { error } = await supabase
      .from(config.table)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete error:', error);
      return res.status(500).json({
        success: false,
        message: '删除失败'
      });
    }

    return res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('Delete dictionary item error:', error);
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 批量导入字典项
 * POST /api/admin/dictionaries/:dictType/import
 */
export async function importDictionary(req: AuthRequest, res: Response) {
  try {
    const { dictType } = req.params;
    const { items } = req.body;

    const config = DICTIONARY_TABLES[dictType];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: '无效的字典类型'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '需要提供项目数组'
      });
    }

    // 添加时间戳到所有项
    const records = items.map(item => ({
      ...item,
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString()
    }));

    // 批量插入
    const { data: inserted, error } = await supabase
      .from(config.table)
      .insert(records)
      .select();

    if (error) {
      console.error('Batch insert error:', error);
      return res.status(500).json({
        success: false,
        message: '批量导入失败'
      });
    }

    return res.json({
      success: true,
      message: `成功导入${inserted?.length || 0}条记录`,
      data: {
        imported: inserted?.length || 0,
        items: inserted || []
      }
    });
  } catch (error) {
    console.error('Import dictionary error:', error);
    res.status(500).json({
      success: false,
      message: '导入失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 导出字典项
 * GET /api/admin/dictionaries/:dictType/export
 */
export async function exportDictionary(req: AuthRequest, res: Response) {
  try {
    const { dictType } = req.params;

    const config = DICTIONARY_TABLES[dictType];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: '无效的字典类型'
      });
    }

    // 查询所有数据
    const { data, error } = await supabase
      .from(config.table)
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: '导出失败'
      });
    }

    // 设置下载头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${dictType}-${Date.now()}.json"`);

    res.json({
      dictType,
      exported_at: new Date().toISOString(),
      total_count: data?.length || 0,
      items: data || []
    });
  } catch (error) {
    console.error('Export dictionary error:', error);
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
