import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { UnauthorizedError } from '../shared/errors'

export interface AuthRequest<P = Record<string, string>, ResBody = unknown, ReqBody = unknown, Query = Record<string, unknown>> extends Request<P, ResBody, ReqBody, Query> {
  userId?: string
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as { userId: string }
      req.userId = payload.userId
    } catch {
      // Invalid token, continue as guest
    }
  }
  next()
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('请先登录')
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    throw new UnauthorizedError('登录已过期，请重新登录')
  }
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' })
}
