import { z } from 'zod'

const pageSchema = z.object({
  image_url: z.string().default(''),
  description: z.string().default(''),
  dialogue: z.string().default(''),
  ai_generated: z.boolean().default(false),
})

export const createWorkSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(['comic', 'drama', 'novel']).default('comic'),
  cover_image: z.string().optional(),
  allow_fork: z.boolean().default(true),
  pages: z.array(pageSchema).optional(),
})

export const forkWorkSchema = z.object({
  subtitle: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  cover_image: z.string().optional(),
  fork_from_page: z.number().int().positive().optional(),
  pages: z.array(pageSchema).optional(),
})

export const updateBookmarkSchema = z.object({
  read_status: z.enum(['want_read', 'reading', 'finished']).optional(),
  last_read_page: z.number().int().min(0).optional(),
})

export type CreateWorkInput = z.input<typeof createWorkSchema>
export type ForkWorkInput = z.input<typeof forkWorkSchema>
export type PageInput = z.input<typeof pageSchema>
