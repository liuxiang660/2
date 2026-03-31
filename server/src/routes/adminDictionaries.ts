import express from 'express';
import {
  getDictionary,
  createDictionaryItem,
  updateDictionaryItem,
  deleteDictionaryItem,
  importDictionary,
  exportDictionary
} from '../controllers/adminDictController';
import {
  authMiddleware,
  requireAnyPermission
} from '../middleware/auth';

const router = express.Router();

/**
 * 所有路由需要认证和编辑以上权限
 */
router.use(authMiddleware);
router.use(requireAnyPermission(['EDITOR', 'ADMIN']));

/**
 * 获取字典数据
 * GET /api/admin/dictionaries/:dictType
 */
router.get('/:dictType', getDictionary);

/**
 * 创建字典项 (需要EDITOR权限)
 * POST /api/admin/dictionaries/:dictType
 */
router.post('/:dictType', createDictionaryItem);

/**
 * 更新字典项 (需要EDITOR权限)
 * PUT /api/admin/dictionaries/:dictType/:id
 */
router.put('/:dictType/:id', updateDictionaryItem);

/**
 * 删除字典项 (需要ADMIN权限)
 * DELETE /api/admin/dictionaries/:dictType/:id
 */
router.delete('/:dictType/:id', requireAnyPermission(['ADMIN']), deleteDictionaryItem);

/**
 * 批量导入 (需要ADMIN权限)
 * POST /api/admin/dictionaries/:dictType/import
 */
router.post('/:dictType/import', requireAnyPermission(['ADMIN']), importDictionary);

/**
 * 导出字典 (需要EDITOR权限)
 * GET /api/admin/dictionaries/:dictType/export
 */
router.get('/:dictType/export', exportDictionary);

export default router;
