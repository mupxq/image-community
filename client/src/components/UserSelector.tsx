import { useUser } from '../contexts/UserContext'

export default function UserSelector() {
  const { currentUser, setCurrentUser, allUsers } = useUser()

  return (
    <div className="px-4 py-3">
      <div className="text-sm text-text-secondary mb-2">选择创作身份</div>
      <div className="flex flex-wrap gap-2">
        {allUsers.map((u) => (
          <button
            key={u.id}
            onClick={() => setCurrentUser(u.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
              u.id === currentUser
                ? 'border-primary bg-primary/20 text-text'
                : 'border-border bg-bg-card text-text-secondary hover:border-primary-light'
            }`}
          >
            <span>{u.avatar}</span>
            <span>{u.nickname}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
