import { Response, NextFunction } from 'express'
import type { AuthRequest } from './auth'

// camelCase → snake_case converter for API responses
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function transformKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(transformKeys)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[toSnakeCase(key)] = transformKeys(value)
    }
    return result
  }
  return obj
}

// Override res.json to auto-serialize camelCase → snake_case
export function serializeResponse(req: AuthRequest, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res)
  res.json = (body: unknown) => {
    return originalJson(transformKeys(body))
  }
  next()
}
