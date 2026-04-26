import { useState } from 'react'
import type { Comment } from '../types'
import { commentsApi } from '../api'
import { useUser } from '../contexts/UserContext'

export default function CommentSection({ workId, comments: initialComments }: { workId: number; comments: Comment[] }) {
  const { currentUser } = useUser()
  const [comments, setComments] = useState(initialComments)
  const [content, setContent] = useState('')

  const submit = async () => {
    if (!content.trim()) return
    await commentsApi.create(workId, { user_id: currentUser, content: content.trim() })
    const updated = await commentsApi.list(workId)
    setComments(updated)
    setContent('')
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">评论 ({comments.length})</h3>
      {comments.length === 0 && <p className="text-xs text-text-secondary">暂无评论</p>}
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <div className="text-lg shrink-0">{c.avatar}</div>
          <div className="min-w-0">
            <div className="text-xs font-medium">{c.nickname}</div>
            <div className="text-xs text-text-secondary mt-0.5">{c.content}</div>
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <input
          className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-primary"
          placeholder="写评论..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button onClick={submit} className="px-4 py-2 bg-primary rounded-lg text-sm text-white hover:bg-primary-light transition-colors">
          发送
        </button>
      </div>
    </div>
  )
}
