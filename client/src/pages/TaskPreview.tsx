import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasksApi, aiApi, uploadApi } from '../api'
import BackHeader from '../components/BackHeader'
import LazyImage from '../components/LazyImage'

export default function TaskPreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverLoading, setCoverLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    tasksApi.getById(Number(id)).then((t) => {
      setTask(t)
      if (t.result) {
        setTitle(t.result.title || '')
        setDesc(t.result.hookDescription || t.result.description || '')
      }
    })
  }, [id])

  const handleGenerateCover = async () => {
    if (!task?.result?.coverPrompt) { alert('无封面提示词'); return }
    setCoverLoading(true)
    try {
      const inputParams = task.input_params
      // 判断是否有自定义 imageConfig
      let data: any = { coverPrompt: task.result.coverPrompt, style: inputParams?.style || '' }
      if (inputParams?.imageConfig) {
        // 自定义模式 — 需重新获取完整 config
        const config = await aiApi.getConfig()
        data.customConfig = { baseUrl: config.image_base_url, apiKey: config.image_api_key, model: config.image_model }
      } else if (inputParams?.imageProvider) {
        data.provider = inputParams.imageProvider
      } else {
        // fallback: 使用平台默认图片 provider
        const providers = await aiApi.getProviders()
        if (providers.imageProviders.length > 0) {
          data.provider = providers.imageProviders[0].id
        }
      }
      const res = await aiApi.generateCover(data)
      setCoverImage(res.cover_image)
    } catch (err: any) {
      alert(err.message || '封面生成失败')
    } finally {
      setCoverLoading(false)
    }
  }

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await uploadApi.image(file)
      setCoverImage(res.url)
    } catch (err: any) {
      alert(err.message || '上传失败')
    }
  }

  const handlePublish = async () => {
    if (!id) return
    setPublishing(true)
    try {
      const res = await tasksApi.publish(Number(id), { title, description: desc, cover_image: coverImage || undefined })
      navigate(`/work/${res.id}`)
    } catch (err: any) {
      alert(err.message || '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  if (!task) return <div className="p-4 text-text-secondary">加载中...</div>

  if (task.status === 'generating') {
    return (
      <div className="pb-20">
        <BackHeader title="创作任务" />
        <div className="px-4 py-12 text-center">
          <div className="text-4xl animate-pulse mb-4">⏳</div>
          <div className="text-sm text-text-secondary">正在生成中，请稍后再来查看...</div>
        </div>
      </div>
    )
  }

  if (task.status === 'failed') {
    return (
      <div className="pb-20">
        <BackHeader title="创作任务" />
        <div className="px-4 py-12 text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-sm text-accent-pink">{task.error || '生成失败'}</div>
        </div>
      </div>
    )
  }

  const pages = task.result?.pages || []

  return (
    <div className="pb-20">
      <BackHeader title="预览并发布" />
      <div className="px-4 space-y-4">
        {/* 封面图 */}
        <div>
          <label className="text-xs text-text-secondary">封面海报（可选）</label>
          <input type="file" accept="image/*" ref={coverInputRef} className="hidden" onChange={handleUploadCover} />
          {coverImage ? (
            <div className="mt-2 relative rounded-xl overflow-hidden">
              <LazyImage src={coverImage} alt="封面" className="w-full h-48" />
              <div className="absolute top-2 right-2 flex gap-1.5">
                <button onClick={() => coverInputRef.current?.click()} className="px-2 py-1 bg-black/50 text-white text-[10px] rounded">更换</button>
                <button onClick={() => setCoverImage('')} className="px-2 py-1 bg-black/50 text-white text-[10px] rounded">移除</button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleGenerateCover}
                disabled={coverLoading}
                className="flex-1 py-2.5 bg-primary/10 border border-primary/30 rounded-lg text-xs text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {coverLoading ? '生成中...' : 'AI 生成封面'}
              </button>
              <button
                onClick={() => coverInputRef.current?.click()}
                className="flex-1 py-2.5 bg-bg-card border border-border rounded-lg text-xs text-text-secondary hover:border-primary transition-colors"
              >
                上传封面
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-text-secondary">作品标题</label>
          <input className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-text-secondary">作品简介（展示给读者的推荐语）</label>
          <textarea className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary resize-none" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        {task.credits_used > 0 && (
          <div className="text-xs text-text-secondary">本次生成消耗 {task.credits_used} 积分</div>
        )}

        <div>
          <h3 className="text-sm font-semibold mb-2">
            {task.type === 'novel' ? `章节内容 (${pages.length}章)` : `分镜内容 (${pages.length}页)`}
          </h3>
          <div className="space-y-2">
            {pages.map((page: any, i: number) => (
              <div key={i} className="bg-bg-card rounded-xl overflow-hidden">
                {task.type === 'novel' ? (
                  <div className="p-3">
                    {page.dialogue && <div className="text-sm font-semibold mb-1">第{i + 1}章 {page.dialogue}</div>}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">{page.description}</div>
                  </div>
                ) : (
                  <>
                    {page.image_url && <img src={page.image_url} alt={`第${i + 1}页`} className="w-full" />}
                    <div className="p-3">
                      <div className="text-[10px] text-text-secondary">第{page.pageNumber}页</div>
                      {page.dialogue && <div className="text-sm text-primary-light mt-0.5">"{page.dialogue}"</div>}
                      <div className="text-xs text-text-secondary mt-1">{page.description}</div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <button onClick={handlePublish} disabled={publishing} className="w-full py-3 bg-primary rounded-lg text-sm text-white font-medium hover:bg-primary-light transition-colors disabled:opacity-50">
          {publishing ? '发布中...' : '确认发布'}
        </button>
      </div>
    </div>
  )
}
