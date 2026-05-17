import { z } from 'zod'

export const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  parent_id: z.string().uuid().optional(),
})

export const followTargetSchema = z.object({
  target_user_id: z.string().uuid(),
})

export const bookmarkCreateSchema = z.object({
  work_id: z.string().uuid(),
})

export const bookmarkUpdateSchema = z.object({
  read_status: z.enum(['want_read', 'reading', 'finished']).optional(),
  last_read_page: z.number().int().min(0).optional(),
})

export const subscriptionCreateSchema = z.object({
  work_id: z.string().uuid(),
})
