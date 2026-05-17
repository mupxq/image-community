import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../shared/errors'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(`[Error] ${err.message}`, err.stack)

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  // Drizzle / pg errors
  if (err.message?.includes('duplicate key')) {
    res.status(409).json({ error: 'Resource already exists' })
    return
  }

  if (err.message?.includes('violates foreign key')) {
    res.status(400).json({ error: 'Invalid reference: related resource not found' })
    return
  }

  res.status(500).json({ error: 'Internal server error' })
}
