import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { worksApi, bookmarksApi, commentsApi } from '../api'
import type { WorkDetail as WorkDetailType, WorkPage, Comment } from '../types'
import { useUser } from '../contexts/UserContext'
import BackHeader from '../components/BackHeader'
import CommentSection from '../components/CommentSection'
import UserAvatar from '../components/UserAvatar'
import LazyImage from '../components/LazyImage'
import SharePoster from '../components/SharePoster'

export default function WorkDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const highlightCommentId = searchParams.get('comment') ? Number(searchParams.get('comment')) : undefined
  const navigate = useNavigate()
  const { user } = useUser()
  const [work, setWork] = useState<WorkDetailType | null>(null)
  const [pages, setPages] = useState<WorkPage[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [showShare, setShowShare] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      worksApi.getById(Number(id)),
      worksApi.getPages(Number(id)),
      commentsApi.list(Number(id)),
    ]).then(([w, p, c]) => {
      setWork(w)
      setPages(p)
      setComments(c)
    })
  }, [id])

  const addToShelf = async () => {
    if (!work) return
    if (!user) { navigate('/login'); return }
    const check = await bookmarksApi.check(work.id)
    if (check.bookmarked) {
      alert('已在书架中')
      return
    }
    await bookmarksApi.create({ work_id: work.id })
    alert('已加入书架')
  }

  const handleDeleteWork = async () => {
    if (!work || !confirm('确定删除此作品？删除后无法恢复。')) return
    try {
      await worksApi.delete(work.id)
      navigate('/profile')
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  if (!work) return <div className="p-4 text-text-secondary">加载中...</div>

  const pagesContent = (
    <div>
      <h3 className="text-sm font-semibold mb-3">
        {work.type === 'novel' ? `正文 (${pages.length}章)` : `分镜内容 (${pages.length}页)`}
      </h3>
      <div className="space-y-3">
        {pages.map((page) => (
          <div key={page.id} className="bg-bg-card rounded-xl overflow-hidden">
            {work.type === 'novel' ? (
              <div className="p-4">
                {page.dialogue && (
                  <div className="text-sm font-semibold mb-2">第{page.page_number}章 {page.dialogue}</div>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{page.description}</div>
              </div>
            ) : (
              <>
                {page.image_url ? (
                  <LazyImage src={page.image_url} alt={`第${page.page_number}页`} className="w-full min-h-[120px]" />
                ) : (
                  <div className="bg-gradient-to-br from-bg-secondary to-bg-card p-4 min-h-[80px] flex items-center text-sm">
                    {page.description}
                  </div>
                )}
                <div className="px-4 py-2">
                  <div className="text-[10px] text-text-secondary">第{page.page_number}页</div>
                  {page.dialogue && (
                    <div className="text-sm text-primary-light mt-0.5">"{page.dialogue}"</div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  const infoContent = (
    <div className="space-y-5">
      {/* Hero */}
      <div>
        <h2 className="text-lg font-bold">{work.title}</h2>
        <p className="text-sm text-text-secondary mt-1">{work.description}</p>
        {work.parentWork && (
          <button
            onClick={() => navigate(`/work/${work.parentWork!.id}`)}
            className="text-xs text-primary mt-2 hover:underline"
          >
            续写自「{work.parentWork.title}」by {work.parentWork.creator_name}
          </button>
        )}
      </div>

      {/* Contributors */}
      <div>
        <div className="text-xs text-text-secondary mb-2">共创者 ({work.contributors.length}人)</div>
        <div className="flex flex-wrap gap-2">
          {work.contributors.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 bg-bg-card px-2.5 py-1 rounded-full text-xs cursor-pointer" onClick={() => navigate(`/user/${c.id}`)}>
              <UserAvatar avatar={c.avatar} nickname={c.nickname} size="sm" />
              <span>{c.nickname}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                c.role === 'creator' ? 'bg-primary/20 text-primary-light' : 'bg-accent/20 text-accent'
              }`}>
                {c.role === 'creator' ? '创作者' : '上游作者'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => user ? navigate(`/fork/${work.id}`) : navigate('/login')}
          className="flex-1 py-2.5 bg-primary rounded-lg text-sm text-white hover:bg-primary-light transition-colors"
        >
          续写此作品
        </button>
        <button
          onClick={() => navigate(`/work/${work.id}/tree`)}
          className="flex-1 py-2.5 bg-bg-card border border-border rounded-lg text-sm hover:border-primary transition-colors"
        >
          创作树
        </button>
        <button
          onClick={addToShelf}
          className="flex-1 py-2.5 bg-bg-card border border-border rounded-lg text-sm hover:border-primary transition-colors"
        >
          加入书架
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="flex-1 py-2.5 bg-bg-card border border-border rounded-lg text-sm hover:border-primary transition-colors"
        >
          分享
        </button>
      </div>
      {user && user.id === work.creator_id && (
        <button
          onClick={handleDeleteWork}
          className="w-full py-2.5 bg-bg-card border border-accent-pink/30 rounded-lg text-sm text-accent-pink hover:bg-accent-pink/10 transition-colors"
        >
          删除作品
        </button>
      )}

      {/* Comments */}
      <CommentSection workId={work.id} comments={comments} highlightId={highlightCommentId} />
    </div>
  )

  return (
    <div className="pb-20 md:pb-6">
      <BackHeader title={work.title} />

      {/* Mobile: vertical layout */}
      <div className="md:hidden px-4 space-y-5">
        {/* Hero */}
        <div>
          <h2 className="text-lg font-bold">{work.title}</h2>
          <p className="text-sm text-text-secondary mt-1">{work.description}</p>
          {work.parentWork && (
            <button
              onClick={() => navigate(`/work/${work.parentWork!.id}`)}
              className="text-xs text-primary mt-2 hover:underline"
            >
              续写自「{work.parentWork.title}」by {work.parentWork.creator_name}
            </button>
          )}
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-2">共创者 ({work.contributors.length}人)</div>
          <div className="flex flex-wrap gap-2">
            {work.contributors.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 bg-bg-card px-2.5 py-1 rounded-full text-xs cursor-pointer" onClick={() => navigate(`/user/${c.id}`)}>
                <UserAvatar avatar={c.avatar} nickname={c.nickname} size="sm" />
                <span>{c.nickname}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  c.role === 'creator' ? 'bg-primary/20 text-primary-light' : 'bg-accent/20 text-accent'
                }`}>
                  {c.role === 'creator' ? '创作者' : '上游作者'}
                </span>
              </div>
            ))}
          </div>
        </div>
        {pagesContent}
        <div className="flex gap-2">
          <button
            onClick={() => user ? navigate(`/fork/${work.id}`) : navigate('/login')}
            className="flex-1 py-2.5 bg-primary rounded-lg text-sm text-white hover:bg-primary-light transition-colors"
          >
            续写此作品
          </button>
          <button
            onClick={() => navigate(`/work/${work.id}/tree`)}
            className="flex-1 py-2.5 bg-bg-card border border-border rounded-lg text-sm hover:border-primary transition-colors"
          >
            创作树
          </button>
          <button
            onClick={addToShelf}
            className="flex-1 py-2.5 bg-bg-card border border-border rounded-lg text-sm hover:border-primary transition-colors"
          >
            加入书架
          </button>
          <button
            onClick={() => setShowShare(true)}
            className="flex-1 py-2.5 bg-bg-card border border-border rounded-lg text-sm hover:border-primary transition-colors"
          >
            分享
          </button>
        </div>
        {user && user.id === work.creator_id && (
          <button
            onClick={handleDeleteWork}
            className="w-full py-2.5 bg-bg-card border border-accent-pink/30 rounded-lg text-sm text-accent-pink hover:bg-accent-pink/10 transition-colors"
          >
            删除作品
          </button>
        )}
        <CommentSection workId={work.id} comments={comments} highlightId={highlightCommentId} />
      </div>

      {/* PC: left-right layout */}
      <div className="hidden md:flex gap-6 px-6">
        <div className="w-[60%] max-h-[calc(100vh-80px)] overflow-y-auto pr-2">
          {pagesContent}
        </div>
        <div className="w-[40%] max-h-[calc(100vh-80px)] overflow-y-auto">
          {infoContent}
        </div>
      </div>

      {showShare && (
        <SharePoster
          title={work.title}
          description={work.description}
          coverImage={work.cover_image || undefined}
          creatorName={work.creator_name || ''}
          workUrl={`${window.location.origin}${window.location.pathname}#/work/${work.id}`}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}
