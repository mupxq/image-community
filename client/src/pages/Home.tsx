import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { worksApi } from '../api'
import type { Work } from '../types'
import WorkCard from '../components/WorkCard'

const filters = [
  { value: 'all', label: '全部' },
  { value: 'comic', label: '漫画' },
  { value: 'drama', label: '短剧' },
]

export default function Home() {
  const [works, setWorks] = useState<Work[]>([])
  const [type, setType] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    worksApi.list({ type }).then(setWorks)
  }, [type])

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-gradient-to-br from-bg to-bg-secondary px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary-light bg-clip-text text-transparent">
          发现
        </h1>
        <p className="text-xs text-text-secondary mt-0.5">探索社区中的精彩创作</p>
      </div>

      <div className="flex gap-1 px-4 py-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setType(f.value)}
            className={`px-4 py-1.5 rounded-full text-xs transition-colors ${
              type === f.value
                ? 'bg-primary text-white'
                : 'bg-bg-card text-text-secondary hover:text-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 mt-2">
        {works.map((work, i) => (
          <WorkCard key={work.id} work={work} index={i} onClick={() => navigate(`/work/${work.id}`)} />
        ))}
      </div>

      {works.length === 0 && (
        <div className="text-center py-20 text-text-secondary text-sm">暂无作品</div>
      )}
    </div>
  )
}
