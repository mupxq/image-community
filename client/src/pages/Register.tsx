import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '../contexts/UserContext'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useUser()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (username.length < 3 || username.length > 20) {
      setError('用户名长度应为3-20个字符')
      return
    }
    if (password.length < 6) {
      setError('密码至少6个字符')
      return
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致')
      return
    }
    if (!nickname.trim()) {
      setError('昵称不能为空')
      return
    }

    setLoading(true)
    try {
      await register(username, password, nickname.trim())
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text text-center mb-8">注册影像社区</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text focus:outline-none focus:border-primary"
              placeholder="3-20个字符"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text focus:outline-none focus:border-primary"
              placeholder="至少6个字符"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text focus:outline-none focus:border-primary"
              placeholder="再次输入密码"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text focus:outline-none focus:border-primary"
              placeholder="展示给其他用户的名称"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="text-center text-text-secondary text-sm mt-6">
          已有账号？
          <Link to="/login" className="text-primary hover:underline ml-1">登录</Link>
        </p>
      </div>
    </div>
  )
}
