import { ValidationError } from '../../shared/errors'
import type { CreditsRepository } from './credits.repository'
import type { UsersRepository } from '../users/users.repository'

export class CreditsService {
  constructor(
    private repo: CreditsRepository,
    private usersRepo: UsersRepository,
  ) {}

  async checkIn(userId: string) {
    const today = new Date().toISOString().slice(0, 10)

    const existing = await this.repo.getTodayCheckIn(userId, today)
    if (existing) throw new ValidationError('今日已签到')

    // Calculate streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const lastCheckIn = await this.repo.getLastCheckIn(userId)

    let streak = 1
    if (lastCheckIn && lastCheckIn.checkDate === yesterday) {
      streak = lastCheckIn.streak + 1
    }

    // Calculate credits: base 100, 7th day bonus +400
    let creditsEarned = 100
    if (streak % 7 === 0) creditsEarned = 500

    await this.repo.createCheckIn({ userId, checkDate: today, streak, creditsEarned })

    // Add credits to user
    const user = await this.usersRepo.findById(userId)
    if (user) {
      await this.usersRepo.updateCredits(userId, user.credits + creditsEarned)
    }

    // Credit log
    const desc = streak % 7 === 0 ? `连续签到${streak}天奖励` : '每日签到'
    await this.repo.createLog({ userId, amount: creditsEarned, type: 'check_in', description: desc })

    const updated = await this.usersRepo.findById(userId)
    return {
      creditsEarned,
      streak,
      totalCredits: updated!.credits,
      message: streak % 7 === 0
        ? `连续签到${streak}天！额外奖励400积分！`
        : `签到成功！+${creditsEarned}积分`,
    }
  }

  async getStatus(userId: string) {
    const user = await this.usersRepo.findById(userId)
    if (!user) throw new ValidationError('用户不存在')

    const today = new Date().toISOString().slice(0, 10)
    const todayCheckIn = await this.repo.getTodayCheckIn(userId, today)
    const lastCheckIn = await this.repo.getLastCheckIn(userId)

    return {
      credits: user.credits,
      checkedInToday: !!todayCheckIn,
      streak: lastCheckIn?.streak ?? 0,
    }
  }

  async getLogs(userId: string) {
    return this.repo.getLogs(userId)
  }
}
