import type { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const details = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      res.status(400).json({ error: 'Validation failed', details })
      return
    }
    req.body = result.data
    next()
  }
}
