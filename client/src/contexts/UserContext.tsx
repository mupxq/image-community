import { createContext, useContext, useState, type ReactNode } from 'react'
import type { User } from '../types'
import { usersApi } from '../api'

interface UserContextType {
  currentUser: number
  setCurrentUser: (id: number) => void
  allUsers: User[]
  setAllUsers: (users: User[]) => void
  ensureUsers: () => Promise<void>
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState(1)
  const [allUsers, setAllUsers] = useState<User[]>([])

  const ensureUsers = async () => {
    if (allUsers.length === 0) {
      const users = await usersApi.getAll()
      setAllUsers(users)
    }
  }

  return (
    <UserContext value={{ currentUser, setCurrentUser, allUsers, setAllUsers, ensureUsers }}>
      {children}
    </UserContext>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
