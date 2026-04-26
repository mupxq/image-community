import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { AuthUser } from '../types'
import { authApi } from '../api'

interface UserContextType {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, nickname: string) => Promise<void>
  logout: () => void
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    authApi.me().then(setUser).catch(() => {
      localStorage.removeItem('token')
    }).finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { token, user: authedUser } = await authApi.login({ username, password })
    localStorage.setItem('token', token)
    setUser(authedUser)
  }, [])

  const register = useCallback(async (username: string, password: string, nickname: string) => {
    const { token, user: authedUser } = await authApi.register({ username, password, nickname })
    localStorage.setItem('token', token)
    setUser(authedUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
  }, [])

  return (
    <UserContext value={{ user, loading, login, register, logout }}>
      {children}
    </UserContext>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
