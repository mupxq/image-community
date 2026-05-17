import { z } from 'zod'

export const registerSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(6),
  nickname: z.string().min(1).max(100),
})

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
