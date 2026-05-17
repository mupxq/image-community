import { ForbiddenError } from '../../shared/errors'
import type { BookmarksRepository } from './bookmarks.repository'

export class BookmarksService {
  constructor(private repo: BookmarksRepository) {}

  async addBookmark(userId: string, workId: string) {
    return this.repo.create({ userId, workId })
  }

  async updateBookmark(userId: string, workId: string, data: { readStatus?: string; lastReadPage?: number }) {
    const bm = await this.repo.findByUserAndWork(userId, workId)
    if (!bm) throw new ForbiddenError('书签不存在')
    return this.repo.update(bm.id, data)
  }

  async removeBookmark(userId: string, workId: string) {
    const bm = await this.repo.findByUserAndWork(userId, workId)
    if (!bm) return
    await this.repo.delete(bm.id, userId)
  }

  async checkBookmark(userId: string, workId: string) {
    const bm = await this.repo.findByUserAndWork(userId, workId)
    return { bookmarked: !!bm, bookmark: bm ?? null }
  }

  async getUserBookmarks(userId: string, status?: string) {
    return this.repo.findByUserId(userId, status)
  }
}
