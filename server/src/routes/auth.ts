import express from 'express';
import {
  login,
  register,
  verifyToken,
  getAllUsers,
  updateUserPermissions,
  updateUserStatus
} from '../controllers/authController';
import {
  authMiddleware,
  requirePermission,
  requireMinimumLevel
} from '../middleware/auth';

const router = express.Router();

/**
 * 公开路由（无需认证）
 */

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', login);

/**
 * 验证令牌
 * POST /api/auth/verify
 */
router.post('/verify', verifyToken);

/**
 * 需要认证的路由
 */

/**
 * 注册新用户（仅管理员）
 * POST /api/auth/register
 */
router.post('/register', authMiddleware, requirePermission('ADMIN'), register);

/**
 * 获取所有用户（仅管理员）
 * GET /api/auth/users
 */
router.get('/users', authMiddleware, requirePermission('ADMIN'), getAllUsers);

/**
 * 更新用户权限（仅管理员）
 * PUT /api/auth/users/:userId/permissions
 */
router.put(
  '/users/:userId/permissions',
  authMiddleware,
  requirePermission('ADMIN'),
  updateUserPermissions
);

/**
 * 禁用/启用用户（仅管理员）
 * PATCH /api/auth/users/:userId/status
 */
router.patch(
  '/users/:userId/status',
  authMiddleware,
  requirePermission('ADMIN'),
  updateUserStatus
);

export default router;
