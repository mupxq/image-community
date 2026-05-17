import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../../config'
import { ConflictError, NotFoundError, UnauthorizedError } from '../../shared/errors'
import type { UsersRepository } from '../users/users.repository'
import type { RegisterInput, LoginInput } from './auth.schema'

export class AuthService {
  constructor(private usersRepo: UsersRepository) {}

  async register(input: RegisterInput) {
    const existing = await this.usersRepo.findByUsername(input.username)
    if (existing) {
      throw new ConflictError('用户名已被使用')
    }

    const passwordHash = await bcrypt.hash(input.password, 10)
    const user = await this.usersRepo.create({
      username: input.username,
      passwordHash,
      nickname: input.nickname,
    })

    const token = this.generateToken(user.id)

    return {
      token,
      user: this.sanitizeUser(user),
    }
  }

  async login(input: LoginInput) {
    const user = await this.usersRepo.findByUsername(input.username)
    if (!user) {
      throw new NotFoundError('该账号未注册，请先注册')
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedError('密码错误')
    }

    const token = this.generateToken(user.id)

    return {
      token,
      user: this.sanitizeUser(user),
    }
  }

  async getMe(userId: string) {
    const user = await this.usersRepo.findById(userId)
    if (!user) return undefined
    return this.sanitizeUser(user)
  }

  verifyToken(token: string): string {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string }
    return payload.userId
  }

  private generateToken(userId: string): string {
    return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' })
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...safe } = user
    return safe
  }
}
