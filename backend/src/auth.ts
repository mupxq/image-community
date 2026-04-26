import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'image-community-dev-secret'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AuthRequest<P = {}, ResBody = unknown, ReqBody = unknown, Query = unknown> extends Request<P, ResBody, ReqBody, Query> {
  userId?: number
}

// 可选认证：有 token 则解析，无 token 也放行（游客浏览）
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: number }
      req.userId = payload.userId
    } catch {
      // token 无效，继续作为游客
    }
  }
  next()
}

// 必须认证：无有效 token 返回 401
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' })
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: number }
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}
