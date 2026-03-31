import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/password';
import { AuthRequest } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * JWT认证中间件
 * 验证请求中的JWT令牌
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '缺少认证令牌'
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token, JWT_SECRET);

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: '无效的或已过期的令牌'
      });
    }

    // 将用户信息保存到请求对象中
    (req as AuthRequest).user = {
      id: payload.userId,
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      permissions: payload.permissions
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: '认证失败'
    });
  }
}

/**
 * 权限检查中间件工厂函数
 * @param requiredPermissionCode 需要的权限代码 (e.g., 'ADMIN', 'EDITOR', 'VIEWER')
 */
export function requirePermission(requiredPermissionCode: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const hasPermission = user.permissions?.some(
      (p: any) => p.code === requiredPermissionCode
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `需要${requiredPermissionCode}权限`
      });
    }

    next();
  };
}

/**
 * 权限检查中间件（多权限或）
 * @param permissionCodes 权限代码数组（任意一个即可）
 */
export function requireAnyPermission(permissionCodes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const hasPermission = user.permissions?.some((p: any) =>
      permissionCodes.includes(p.code)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `需要以下权限之一: ${permissionCodes.join(', ')}`
      });
    }

    next();
  };
}

/**
 * 权限等级检查中间件
 * @param minLevel 最小权限等级 (1=VIEWER, 2=EDITOR, 3=ADMIN)
 */
export function requireMinimumLevel(minLevel: number) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const maxLevel = Math.max(...(user.permissions?.map((p: any) => p.level) || [0]));

    if (maxLevel < minLevel) {
      return res.status(403).json({
        success: false,
        message: '权限等级不足'
      });
    }

    next();
  };
}
