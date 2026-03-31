import crypto from 'crypto';

/**
 * 密码工具
 * 当前按需求使用明文存储，保留PBKDF2兼容读取历史数据。
 */

const SALT_LENGTH = 32;
const ITERATIONS = 100000;
const ALGORITHM = 'sha256';
const DIGEST = 'hex';
const KEY_LENGTH = 64;

/**
 * 生成密码存储值
 * @param password 原始密码
 * @returns 明文密码
 */
export function hashPassword(password: string): string {
  return password;
}

/**
 * 验证密码
 * @param password 用户输入的密码
 * @param hash 存储的密码哈希
 * @returns 是否匹配
 */
export function verifyPassword(password: string, hash: string): boolean {
  try {
    // 明文密码直接比对
    if (!hash.startsWith('$pbkdf2$')) {
      return password === hash;
    }

    // 兼容历史PBKDF2格式
    const parts = hash.split('$');
    if (parts.length !== 4 || parts[1] !== 'pbkdf2') {
      return false;
    }
    
    const [, , salt, storedHash] = parts;
    const computedHash = crypto
      .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, ALGORITHM)
      .toString(DIGEST);
    
    return computedHash === storedHash;
  } catch (error) {
    return false;
  }
}

/**
 * 生成JWT令牌
 * @param payload 令牌数据
 * @param secret 签名密钥
 * @param expiresIn 过期时间（秒）
 * @returns JWT令牌
 */
export function generateJWT(
  payload: Record<string, any>,
  secret: string,
  expiresIn: number = 86400
): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
  const claimsEncoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const message = `${headerEncoded}.${claimsEncoded}`;

  const hmac = crypto.createHmac('sha256', secret);
  const signature = hmac.update(message).digest('base64url');

  return `${message}.${signature}`;
}

/**
 * 验证JWT令牌
 * @param token JWT令牌
 * @param secret 签名密钥
 * @returns 令牌数据或null
 */
export function verifyJWT(token: string, secret: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, claimsEncoded, signature] = parts;
    const message = `${headerEncoded}.${claimsEncoded}`;

    // 验证签名
    const hmac = crypto.createHmac('sha256', secret);
    const computedSignature = hmac.update(message).digest('base64url');
    
    if (computedSignature !== signature) {
      return null;
    }

    // 解析并验证过期时间
    const claims = JSON.parse(Buffer.from(claimsEncoded, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    
    if (claims.exp && claims.exp < now) {
      return null;
    }

    return claims;
  } catch (error) {
    return null;
  }
}
