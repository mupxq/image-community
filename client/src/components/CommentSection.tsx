import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Comment } from '../types'
import { commentsApi, followsApi } from '../api'
import { useUser } from '../contexts/UserContext'
import UserAvatar from './UserAvatar'

interface MutualUser {
  id: number
  nickname: string
  avatar: string
  username: string
}

export default function CommentSection({ workId, comments: initialComments, highlightId }: { workId: number; comments: Comment[]; highlightId?: number }) {
  const { user } = useUser()
  const navigate = useNavigate()
  const [comments, setComments] = useState(initialComments)
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: number; nickname: string } | null>(null)
  const [mutuals, setMutuals] = useState<MutualUser[]>([])
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionIndex, setMentionIndex] = useState(-1)
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (highlightId) {
      setTimeout(() => {
        document.getElementById(`comment-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [highlightId])

  useEffect(() => {
    if (user) {
      followsApi.mutualFollowers().then(setMutuals).catch(() => {})
    }
  }, [user])

  const detectMention = (value: string) => {
    // 查找最后一个 @ 后面的文字（支持中英文输入）
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex >= 0) {
      const afterAt = value.slice(lastAtIndex + 1)
      // 如果 @ 后面没有空格且不在字符串最开头（或者 @ 前面是空格/行首），就显示列表
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        setMentionSearch(afterAt)
        const rect = inputRef.current?.getBoundingClientRect()
        if (rect) {
          setMentionPos({ top: rect.top - 210, left: rect.left })
        }
        return
      }
    }
    setMentionSearch('')
    setMentionPos(null)
    setMentionIndex(-1)
  }

  const filteredMutuals = mentionSearch
    ? mutuals.filter(m =>
        m.nickname.includes(mentionSearch) || m.username.includes(mentionSearch)
      )
    : mutuals

  const insertMention = (mu: MutualUser) => {
    const lastAtIndex = content.lastIndexOf('@')
    const newContent = content.slice(0, lastAtIndex) + `@${mu.username} `
    setContent(newContent)
    setMentionSearch('')
    setMentionPos(null)
    setMentionIndex(-1)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionPos && filteredMutuals.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(prev => Math.min(prev + 1, filteredMutuals.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(prev => Math.max(prev - 1, -1))
      } else if (e.key === 'Enter' && mentionIndex >= 0) {
        e.preventDefault()
        insertMention(filteredMutuals[mentionIndex]!)
        return
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setMentionPos(null)
        setMentionIndex(-1)
        return
      }
      // 下拉打开时，非特殊键不阻止（允许继续输入和 Enter 提交）
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  const renderContent = (text: string) => {
    return text.split(/(@\S+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.slice(1)
        return (
          <span key={i} className="text-primary font-medium cursor-pointer hover:underline" onClick={() => {
            const mu = mutuals.find(m => m.username === username)
            if (mu) navigate(`/user/${mu.id}`)
          }}>
            {part}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  const submit = async () => {
    if (!content.trim() || submitting || !user) return
    const text = content.trim()
    const parentId = replyTo?.id
    const replyName = replyTo?.nickname || undefined

    // 乐观更新：立即清空输入 + 插入临时评论
    setContent('')
    setReplyTo(null)
    setMentionSearch('')
    setMentionPos(null)
    setMentionIndex(-1)
    setSubmitting(true)

    const optimisticId = -Date.now()
    const optimisticComment: Comment = {
      id: optimisticId,
      work_id: workId,
      user_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      nickname: user.nickname,
      avatar: user.avatar,
      parent_id: parentId || null,
      reply_to_name: replyName || null,
    }
    setComments(prev => [...prev, optimisticComment])

    try {
      await commentsApi.create(workId, { content: text, parent_id: parentId })
      // 用服务端数据替换乐观评论
      const updated = await commentsApi.list(workId)
      setComments(updated)
    } catch (err: any) {
      // 失败：移除乐观评论，恢复输入
      setComments(prev => prev.filter(c => c.id !== optimisticId))
      setContent(text)
      if (replyName) setReplyTo({ id: parentId!, nickname: replyName })
    } finally {
      setSubmitting(false)
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setContent(val)
    detectMention(val)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">评论 ({comments.length})</h3>
      {comments.length === 0 && <p className="text-xs text-text-secondary">暂无评论</p>}
      {comments.map((c) => (
        <div
          key={c.id}
          id={`comment-${c.id}`}
          className={`flex gap-2.5 ${highlightId === c.id ? 'bg-primary/10 rounded-lg p-2 -mx-2' : ''}`}
        >
          <div className="shrink-0 cursor-pointer" onClick={() => navigate(`/user/${c.user_id}`)}>
            <UserAvatar avatar={c.avatar} nickname={c.nickname} size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium cursor-pointer hover:text-primary" onClick={() => navigate(`/user/${c.user_id}`)}>{c.nickname}</span>
              <span className="text-[10px] text-text-secondary">{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
            {c.reply_to_name && (
              <span className="text-[10px] text-primary">回复 @{c.reply_to_name}</span>
            )}
            <div className="text-xs text-text-secondary mt-0.5">{renderContent(c.content)}</div>
            {user && (
              <button
                onClick={() => setReplyTo({ id: c.id, nickname: c.nickname })}
                className="text-[10px] text-text-secondary hover:text-primary mt-1"
              >
                回复
              </button>
            )}
          </div>
        </div>
      ))}
      {user ? (
        <div className="pt-2 relative">
          {replyTo && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-primary">回复 @{replyTo.nickname}</span>
              <button onClick={() => setReplyTo(null)} className="text-[10px] text-text-secondary hover:text-accent-pink">取消</button>
            </div>
          )}
          {/* @mention dropdown */}
          {mentionPos && filteredMutuals.length > 0 && (
            <div className="fixed z-50 bg-bg-card border border-border rounded-xl shadow-lg w-56 max-h-48 overflow-y-auto" style={{ top: mentionPos.top, left: mentionPos.left }}>
              {filteredMutuals.map((mu, i) => (
                <button
                  key={mu.id}
                  onClick={() => insertMention(mu)}
                  className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-bg-secondary transition-colors text-left ${i === mentionIndex ? 'bg-bg-secondary' : ''}`}
                >
                  <UserAvatar avatar={mu.avatar} nickname={mu.nickname} size="sm" />
                  <div>
                    <div className="text-xs font-medium">{mu.nickname}</div>
                    <div className="text-[10px] text-text-secondary">@{mu.username}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-primary"
              placeholder={replyTo ? `回复 @${replyTo.nickname}...` : '写评论... 输入 @ 提及好友'}
              value={content}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
            />
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-primary rounded-lg text-sm text-white hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-2">
          <button onClick={() => navigate('/login')} className="text-sm text-primary hover:underline">
            登录后评论
          </button>
        </div>
      )}
    </div>
  )
}
