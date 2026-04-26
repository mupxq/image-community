import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi } from '../api'
import type { User, Work } from '../types'
import { useUser } from '../contexts/UserContext'

export default function Profile() {
  const navigate = useNavigate()
  const { currentUser, setCurrentUser, allUsers, ensureUsers } = useUser()
  const [user, setUser] = useState<User | null>(null)
  const [works, setWorks] = useState<Work[]>([])
  const [coCreated, setCoCreated] = useState<Work[]>([])

  const load = async () => {
    const [u, w, c] = await Promise.all([
      usersApi.getById(currentUser),
      usersApi.getWorks(currentUser),
      usersApi.getContributions(currentUser),
    ])
    setUser(u)
    setWorks(w)
    const myIds = new Set(w.map((x) => x.id))
    setCoCreated(c.filter((x) => !myIds.has(x.id)))
  }

  useEffect(() => { ensureUsers(); load() }, [currentUser])

  if (!user) return <div className="p-4 text-text-secondary">加载中...</div>

  return (
    <div className="pb-20">
      <div className="px-4 pt-5 pb-3">
        <div className="bg-bg-card rounded-2xl p-5 text-center">
          <div className="text-4xl">{user.avatar}</div>
          <div className="text-lg font-bold mt-2">{user.nickname}</div>
          <div className="text-xs text-text-secondary mt-1">{user.bio}</div>
          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center">
              <div className="text-xl font-bold">{works.length}</div>
              <div className="text-[10px] text-text-secondary">我的作品</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{coCreated.length}</div>
              <div className="text-[10px] text-text-secondary">参与共创</div>
            </div>
          </div>
        </div>
      </div>

      {/* User switcher */}
      <div className="px-4 py-3">
        <div className="text-xs text-text-secondary mb-2">切换用户（Demo模式）</div>
        <div className="flex flex-wrap gap-2">
          {allUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => setCurrentUser(u.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                u.id === currentUser ? 'border-primary bg-primary/20 text-text' : 'border-border bg-bg-card text-text-secondary'
              }`}
            >
              <span>{u.avatar}</span>
              <span>{u.nickname}</span>
            </button>
          ))}
        </div>
      </div>

      {/* My works */}
      <div className="px-4 space-y-2">
        <h3 className="text-sm font-semibold">我的作品</h3>
        {works.length === 0 && <p className="text-xs text-text-secondary">还没有创作作品</p>}
        {works.map((w) => (
          <div key={w.id} onClick={() => navigate(`/work/${w.id}`)} className="flex items-center gap-3 bg-bg-card rounded-lg p-3 cursor-pointer hover:scale-[1.01] transition-transform">
            <span className="text-xl">{w.type === 'comic' ? '📖' : '🎬'}</span>
            <div>
              <div className="text-sm font-medium">{w.title}</div>
              <div className="text-xs text-text-secondary">{w.type === 'comic' ? '漫画' : '短剧'}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Co-created */}
      {coCreated.length > 0 && (
        <div className="px-4 space-y-2 mt-5">
          <h3 className="text-sm font-semibold">参与的共创</h3>
          {coCreated.map((w) => (
            <div key={w.id} onClick={() => navigate(`/work/${w.id}`)} className="flex items-center gap-3 bg-bg-card rounded-lg p-3 cursor-pointer hover:scale-[1.01] transition-transform">
              <span className="text-xl">🤝</span>
              <div>
                <div className="text-sm font-medium">{w.title}</div>
                <div className="text-xs text-text-secondary">by {w.creator_name}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
