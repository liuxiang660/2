import { Request, Response } from 'express';
import { supabase } from '../utils/db';
import { hashPassword, verifyPassword, generateJWT, verifyJWT } from '../utils/password';
import { AuthRequest } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = 86400; // 24 hours

/**
 * 用户登录
 * @route POST /api/auth/login
 * @param {string} username 用户名
 * @param {string} password 密码
 * @returns {Object} { token, user }
 */
export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 查询用户
    const { data: users, error } = await supabase
      .from('user_account')
      .select('*')
      .eq('username', username);

    // 数据库不可用时，提供本地管理员兜底登录，便于开发环境调试
    if (error) {
      if (username === 'admin' && password === 'admin123') {
        const fallbackPermissions = [{ id: 1, code: 'ADMIN', name: '管理员', level: 3 }];
        const token = generateJWT(
          {
            userId: 0,
            username: 'admin',
            email: 'admin@sentry.local',
            permissions: fallbackPermissions
          },
          JWT_SECRET,
          JWT_EXPIRES_IN
        );

        return res.json({
          success: true,
          message: '登录成功（本地兜底模式）',
          data: {
            token,
            user: {
              id: 0,
              username: 'admin',
              email: 'admin@sentry.local',
              fullName: '系统管理员',
              permissions: fallbackPermissions
            }
          }
        });
      }

      return res.status(500).json({
        success: false,
        message: '数据库连接异常，请稍后重试'
      });
    }

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const user = users[0];

    // 检查用户是否激活
    if (user.is_active !== 1) {
      return res.status(403).json({
        success: false,
        message: '用户账户已被禁用'
      });
    }

    // 验证密码
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 查询用户权限
    const { data: permissions, error: permError } = await supabase
      .from('user_permission_relation')
      .select('permission_dict(id, permission_code, permission_name, permission_level)')
      .eq('user_id', user.id);

    if (permError) {
      console.error('Query permissions error:', permError);
    }

    const mappedPermissions =
      permissions?.map((p: any) => ({
        id: p.permission_dict.id,
        code: p.permission_dict.permission_code,
        name: p.permission_dict.permission_name,
        level: p.permission_dict.permission_level
      })) || [];

    const effectivePermissions =
      mappedPermissions.length > 0
        ? mappedPermissions
        : username === 'admin'
        ? [{ id: 1, code: 'ADMIN', name: '管理员', level: 3 }]
        : [{ id: 3, code: 'VIEWER', name: '查看员', level: 1 }];

    // 更新最后登录时间和登录计数
    await supabase
      .from('user_account')
      .update({
        last_login: new Date().toISOString(),
        login_count: (user.login_count || 0) + 1,
        update_time: new Date().toISOString()
      })
      .eq('id', user.id);

    // 生成JWT令牌
    const token = generateJWT(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        permissions: effectivePermissions
      },
      JWT_SECRET,
      JWT_EXPIRES_IN
    );

    return res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          permissions: effectivePermissions
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 用户注册（受权限限制，仅管理员可用）
 * @route POST /api/auth/register
 * @param {string} username 用户名
 * @param {string} password 密码
 * @param {string} email 邮箱
 * @param {string} fullName 全名
 * @param {number} permissionId 权限ID
 */
export async function register(req: AuthRequest, res: Response) {
  try {
    const { username, password, email, fullName, permissionId } = req.body;

    // 检查管理员权限
    const userPermissions = req.user?.permissions || [];
    const isAdmin = userPermissions.some((p: any) => p.code === 'ADMIN');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: '仅管理员可以注册新用户'
      });
    }

    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: '用户名、密码和邮箱不能为空'
      });
    }

    // 检查用户名是否已存在
    const { data: existing } = await supabase
      .from('user_account')
      .select('id')
      .eq('username', username);

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: '用户名已存在'
      });
    }

    // 哈希密码
    const passwordHash = hashPassword(password);

    // 创建新用户
    const { data: newUser, error } = await supabase
      .from('user_account')
      .insert({
        username,
        password_hash: passwordHash,
        email,
        full_name: fullName,
        is_active: 1,
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString()
      })
      .select();

    if (error || !newUser || newUser.length === 0) {
      return res.status(500).json({
        success: false,
        message: '创建用户失败'
      });
    }

    const userId = newUser[0].id;

    // 分配权限
    if (permissionId) {
      const { error: permError } = await supabase
        .from('user_permission_relation')
        .insert({
          user_id: userId,
          permission_id: permissionId,
          granted_by: req.user?.userId,
          grant_time: new Date().toISOString()
        });

      if (permError) {
        console.error('Assign permission error:', permError);
      }
    }

    return res.status(201).json({
      success: true,
      message: '用户创建成功',
      data: {
        id: userId,
        username,
        email,
        fullName
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: '注册失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 验证令牌
 * @route POST /api/auth/verify
 */
export async function verifyToken(req: AuthRequest, res: Response) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '令牌为空'
      });
    }

    const payload = verifyJWT(token, JWT_SECRET);

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }

    return res.json({
      success: true,
      message: '令牌有效',
      data: {
        userId: payload.userId,
        username: payload.username,
        email: payload.email,
        permissions: payload.permissions
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: '验证失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 获取所有用户（仅管理员）
 * @route GET /api/auth/users
 */
export async function getAllUsers(req: AuthRequest, res: Response) {
  try {
    // 检查管理员权限
    const userPermissions = req.user?.permissions || [];
    const isAdmin = userPermissions.some((p: any) => p.code === 'ADMIN');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: '仅管理员可以查看用户列表'
      });
    }

    const { data: users, error } = await supabase
      .from('user_account')
      .select(`
        id,
        username,
        email,
        full_name,
        is_active,
        last_login,
        login_count,
        create_time,
        update_time,
        user_permission_relation(
          permission_dict(id, permission_code, permission_name, permission_level)
        )
      `)
      .order('create_time', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: '查询用户失败'
      });
    }

    return res.json({
      success: true,
      message: '查询成功',
      data: users?.map((user: any) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        isActive: user.is_active,
        lastLogin: user.last_login,
        loginCount: user.login_count,
        createTime: user.create_time,
        permissions: user.user_permission_relation?.map((p: any) => ({
          id: p.permission_dict.id,
          code: p.permission_dict.permission_code,
          name: p.permission_dict.permission_name,
          level: p.permission_dict.permission_level
        })) || []
      })) || []
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 更新用户权限（仅管理员）
 * @route PUT /api/auth/users/:userId/permissions
 */
export async function updateUserPermissions(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { permissionIds } = req.body;

    // 检查管理员权限
    const userPermissions = req.user?.permissions || [];
    const isAdmin = userPermissions.some((p: any) => p.code === 'ADMIN');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: '仅管理员可以更新用户权限'
      });
    }

    // 删除现有权限
    const { error: deleteError } = await supabase
      .from('user_permission_relation')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Delete permissions error:', deleteError);
      return res.status(500).json({
        success: false,
        message: '删除旧权限失败'
      });
    }

    // 添加新权限
    if (permissionIds && permissionIds.length > 0) {
      const permissionRecords = permissionIds.map((permissionId: number) => ({
        user_id: userId,
        permission_id: permissionId,
        granted_by: req.user?.userId,
        grant_time: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('user_permission_relation')
        .insert(permissionRecords);

      if (insertError) {
        console.error('Insert permissions error:', insertError);
        return res.status(500).json({
          success: false,
          message: '添加权限失败'
        });
      }
    }

    return res.json({
      success: true,
      message: '权限更新成功'
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 禁用/启用用户（仅管理员）
 * @route PATCH /api/auth/users/:userId/status
 */
export async function updateUserStatus(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    // 检查管理员权限
    const userPermissions = req.user?.permissions || [];
    const isAdmin = userPermissions.some((p: any) => p.code === 'ADMIN');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: '仅管理员可以修改用户状态'
      });
    }

    const { error } = await supabase
      .from('user_account')
      .update({
        is_active: isActive ? 1 : 0,
        update_time: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({
        success: false,
        message: '更新用户状态失败'
      });
    }

    return res.json({
      success: true,
      message: '用户状态更新成功'
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
