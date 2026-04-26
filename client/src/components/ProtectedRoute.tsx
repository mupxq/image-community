import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useUser()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-text-secondary">加载中...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
