import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi } from '../api'
import type { Work } from '../types'
import { useUser } from '../contexts/UserContext'

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useUser()
  const [works, setWorks] = useState<Work[]>([])
  const [coCreated, setCoCreated] = useState<Work[]>([])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [w, c] = await Promise.all([
        usersApi.getWorks(user.id),
        usersApi.getContributions(user.id),
      ])
      setWorks(w)
      const myIds = new Set(w.map((x) => x.id))
      setCoCreated(c.filter((x) => !myIds.has(x.id)))
    }
    load()
  }, [user])

  // 未登录：显示登录引导
  if (!user) {
    return (
      <div className="pb-20">
        <div className="px-4 pt-5">
          <div className="bg-bg-card rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">👤</div>
            <h2 className="text-lg font-bold">登录影像社区</h2>
            <p className="text-sm text-text-secondary mt-2">登录后可以创作、收藏、互动交流</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 px-8 py-2.5 bg-primary rounded-lg text-sm text-white font-medium hover:bg-primary/90 transition-colors"
            >
              登录 / 注册
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="px-4 pt-5 pb-3">
        <div className="bg-bg-card rounded-2xl p-5 text-center">
          <div className="text-4xl">{user.avatar || '👤'}</div>
          <div className="text-lg font-bold mt-2">{user.nickname}</div>
          <div className="text-xs text-text-secondary mt-1">{user.bio}</div>
          <div className="text-[10px] text-text-secondary mt-1">@{user.username}</div>
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
          <button
            onClick={() => { logout(); navigate('/') }}
            className="mt-4 px-6 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-accent transition-colors"
          >
            退出登录
          </button>
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
