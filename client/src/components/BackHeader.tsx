import { useNavigate } from 'react-router-dom'

export default function BackHeader({ title }: { title: string }) {
  const navigate = useNavigate()

  return (
    <div className="sticky top-0 z-10 bg-gradient-to-br from-bg to-bg-secondary px-4 pt-5 pb-3 flex items-center gap-3">
      <button onClick={() => navigate(-1)} className="text-text-secondary text-lg hover:text-text">
        ←
      </button>
      <h1 className="text-base font-semibold truncate">{title}</h1>
    </div>
  )
}
