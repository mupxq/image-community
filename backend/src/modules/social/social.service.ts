import { ValidationError, ConflictError } from '../../shared/errors'
import type { FollowsRepository } from '../follows/follows.repository'
import type { CommentsRepository } from '../comments/comments.repository'
import type { LikesRepository } from '../likes/likes.repository'
import type { SubscriptionsRepository } from '../subscriptions/subscriptions.repository'

export class SocialService {
  constructor(
    private followsRepo: FollowsRepository,
    private commentsRepo: CommentsRepository,
    private likesRepo: LikesRepository,
    private subsRepo: SubscriptionsRepository,
  ) {}

  // ============ Follows ============

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new ValidationError('不能关注自己')
    try {
      return await this.followsRepo.create({ followerId, followingId })
    } catch (err: any) {
      if (err.message?.includes('duplicate')) throw new ConflictError('已关注')
      throw err
    }
  }

  async unfollow(followerId: string, followingId: string) {
    return this.followsRepo.delete(followerId, followingId)
  }

  async isFollowing(followerId: string, followingId: string) {
    return this.followsRepo.isFollowing(followerId, followingId)
  }

  async getFollowStatus(userId: string, targetId: string) {
    const [isFollowing, isFollowedBy] = await Promise.all([
      this.followsRepo.isFollowing(userId, targetId),
      this.followsRepo.isFollowing(targetId, userId),
    ])
    return { isFollowing, isFollowedBy, isMutual: isFollowing && isFollowedBy }
  }

  async getFollowers(userId: string) {
    return this.followsRepo.findFollowers(userId)
  }

  async getFollowing(userId: string) {
    return this.followsRepo.findFollowing(userId)
  }

  async getMutuals(userId: string) {
    return this.followsRepo.findMutuals(userId)
  }

  async getFollowerCounts(userId: string) {
    const [followers, following] = await Promise.all([
      this.followsRepo.countFollowers(userId),
      this.followsRepo.countFollowing(userId),
    ])
    return { followers, following }
  }

  // ============ Comments ============

  async createComment(workId: string, userId: string, content: string, parentId?: string) {
    return this.commentsRepo.create({ workId, userId, content, parentId })
  }

  async getComments(workId: string) {
    return this.commentsRepo.findByWorkId(workId)
  }

  async deleteComment(commentId: string, userId: string) {
    return this.commentsRepo.delete(commentId, userId)
  }

  // ============ Likes ============

  async toggleWorkLike(workId: string, userId: string) {
    const liked = await this.likesRepo.isWorkLiked(workId, userId)
    if (liked) {
      await this.likesRepo.unlikeWork(workId, userId)
      return false
    }
    await this.likesRepo.likeWork(workId, userId)
    return true
  }

  async togglePageLike(pageId: string, userId: string) {
    try {
      await this.likesRepo.likePage(pageId, userId)
      return true
    } catch {
      await this.likesRepo.unlikePage(pageId, userId)
      return false
    }
  }

  async getWorkLikeStatus(workId: string, userId: string) {
    const [liked, likeCount] = await Promise.all([
      userId ? this.likesRepo.isWorkLiked(workId, userId) : Promise.resolve(false),
      this.likesRepo.countWorkLikes(workId),
    ])
    return { liked, likeCount }
  }

  async getPageLikeStatuses(workId: string, userId: string) {
    return this.likesRepo.getPageLikeStatuses(workId, userId)
  }

  // ============ Subscriptions ============

  async subscribe(userId: string, workId: string) {
    try {
      return await this.subsRepo.create({ userId, workId })
    } catch (err: any) {
      if (err.message?.includes('duplicate')) return // Already subscribed
      throw err
    }
  }

  async unsubscribe(userId: string, workId: string) {
    return this.subsRepo.delete(userId, workId)
  }

  async checkSubscription(userId: string, workId: string) {
    const sub = await this.subsRepo.findByUserAndWork(userId, workId)
    return { subscribed: !!sub, lastViewedForkCount: sub?.lastViewedForkCount ?? 0 }
  }

  async getUserSubscriptions(userId: string) {
    return this.subsRepo.findByUserId(userId)
  }

  async markViewed(userId: string, workId: string, count: number) {
    await this.subsRepo.updateViewedCount(userId, workId, count)
  }
}
