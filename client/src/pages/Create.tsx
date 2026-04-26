import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { worksApi } from '../api'
import type { PageInput } from '../types'
import PagesEditor from '../components/PagesEditor'

const styles = [
  { value: 'cyberpunk', icon: '🌆', name: '赛博朋克' },
  { value: 'watercolor', icon: '🎨', name: '水彩' },
  { value: 'pixel', icon: '👾', name: '像素风' },
  { value: 'ink', icon: '🖌️', name: '水墨' },
  { value: 'comic', icon: '💥', name: '美漫' },
  { value: 'anime', icon: '✨', name: '日漫' },
]

const mockTemplates = [
  { desc: '开篇：故事的世界观展开，一个广阔的场景呈现在眼前', dial: '' },
  { desc: '主角登场，在日常场景中展现性格特点', dial: '又是普通的一天...' },
  { desc: '转折出现，一个意外事件打破了平静', dial: '这是怎么回事？！' },
  { desc: '主角面临选择，气氛变得紧张', dial: '我必须做出决定' },
  { desc: '冲突升级，主角遭遇强大的阻碍', dial: '没想到事情会变成这样...' },
  { desc: '关键时刻，主角获得了新的力量或帮助', dial: '原来如此！我明白了' },
  { desc: '高潮场景，主角与对手正面交锋', dial: '这次，我不会退缩！' },
  { desc: '战斗进入白热化，画面充满张力', dial: '' },
  { desc: '转机出现，意想不到的发展', dial: '不可能...这竟然是...' },
  { desc: '故事迎来阶段性结局，留下悬念', dial: '故事才刚刚开始...' },
  { desc: '尾声：一个新的谜团浮出水面', dial: '' },
  { desc: '彩蛋：暗示下一章的关键线索', dial: '你终于来了...' },
]

export default function Create() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'manual' | 'ai'>('manual')

  // Manual fields
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [type, setType] = useState<'comic' | 'drama'>('comic')
  const [pages, setPages] = useState<PageInput[]>([{ description: '', dialogue: '' }])

  // AI fields
  const [aiType, setAiType] = useState<'comic' | 'drama'>('comic')
  const [synopsis, setSynopsis] = useState('')
  const [aiStyle, setAiStyle] = useState('cyberpunk')
  const [aiPageCount, setAiPageCount] = useState(4)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiStep, setAiStep] = useState(0)
  const [aiResult, setAiResult] = useState<{ title: string; desc: string; pages: PageInput[] } | null>(null)

  const submitManual = async () => {
    if (!title.trim()) return alert('请输入标题')
    if (!pages[0]?.description.trim()) return alert('请至少填写第一页场景描述')
    await worksApi.create({ title: title.trim(), description: desc.trim(), type, pages })
    navigate('/')
  }

  const submitAI = async () => {
    if (!synopsis.trim()) return alert('请输入作品梗概')
    setAiGenerating(true)
    setAiStep(1)
    await new Promise((r) => setTimeout(r, 1200))
    setAiStep(2)
    await new Promise((r) => setTimeout(r, 1500))
    setAiStep(3)
    await new Promise((r) => setTimeout(r, 2000))
    setAiStep(4)

    const mockTitle = synopsis.substring(0, 15) + (synopsis.length > 15 ? '...' : '')
    const mockPages: PageInput[] = Array.from({ length: aiPageCount }, (_, i) => {
      const t = mockTemplates[i % mockTemplates.length]!
      return { description: t.desc, dialogue: t.dial, ai_generated: true }
    })

    setAiResult({ title: mockTitle, desc: synopsis, pages: mockPages })
    setAiGenerating(false)
  }

  const publishAI = async () => {
    if (!aiResult) return
    await worksApi.create({
      title: aiResult.title,
      description: aiResult.desc,
      type: aiType,
      pages: aiResult.pages,
    })
    navigate('/')
  }

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-gradient-to-br from-bg to-bg-secondary px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary-light bg-clip-text text-transparent">创作</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Mode tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 p-3 rounded-xl border text-left transition-colors ${
              mode === 'manual' ? 'border-primary bg-primary/10' : 'border-border bg-bg-card'
            }`}
          >
            <div className="text-sm font-medium">✍️ 自己创作</div>
            <div className="text-[10px] text-text-secondary mt-0.5">上传图片，编辑分镜和对白</div>
          </button>
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 p-3 rounded-xl border text-left transition-colors ${
              mode === 'ai' ? 'border-primary bg-primary/10' : 'border-border bg-bg-card'
            }`}
          >
            <div className="text-sm font-medium">🤖 AI创作</div>
            <div className="text-[10px] text-text-secondary mt-0.5">描述梗概，AI帮你生成作品</div>
          </button>
        </div>

        {mode === 'manual' ? (
          <>
            <div>
              <label className="text-xs text-text-secondary">作品标题</label>
              <input className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-primary" placeholder="给你的作品起个名字" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-text-secondary">作品简介</label>
              <textarea className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-primary resize-none" rows={3} placeholder="简单描述一下你的创作" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-text-secondary">作品类型</label>
              <select className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" value={type} onChange={(e) => setType(e.target.value as 'comic' | 'drama')}>
                <option value="comic">漫画</option>
                <option value="drama">短剧</option>
              </select>
            </div>
            <PagesEditor pages={pages} onChange={setPages} showUpload />
            <button onClick={submitManual} className="w-full py-3 bg-primary rounded-lg text-sm text-white font-medium hover:bg-primary-light transition-colors">发布作品</button>
          </>
        ) : aiGenerating ? (
          <div className="space-y-4 py-8">
            {['正在分析故事梗概...', '正在生成故事大纲和分镜脚本...', `正在生成${aiPageCount}页分镜画面...`].map((text, i) => (
              <div key={i} className={`flex items-center gap-3 ${aiStep > i ? 'text-success' : aiStep === i ? 'text-accent' : 'text-text-secondary'}`}>
                {aiStep > i ? '✓' : aiStep === i ? <span className="animate-spin">⟳</span> : '○'}
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
        ) : aiResult ? (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-success">AI生成完成</div>
            <div>
              <label className="text-xs text-text-secondary">作品标题（可修改）</label>
              <input className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" value={aiResult.title} onChange={(e) => setAiResult({ ...aiResult, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-text-secondary">作品简介（可修改）</label>
              <textarea className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary resize-none" rows={3} value={aiResult.desc} onChange={(e) => setAiResult({ ...aiResult, desc: e.target.value })} />
            </div>
            <PagesEditor pages={aiResult.pages} onChange={(p) => setAiResult({ ...aiResult, pages: p })} />
            <div className="flex gap-2">
              <button onClick={() => { setAiResult(null); submitAI() }} className="flex-1 py-2.5 bg-bg-card border border-border rounded-lg text-sm hover:border-primary transition-colors">重新生成</button>
              <button onClick={publishAI} className="flex-[2] py-2.5 bg-primary rounded-lg text-sm text-white font-medium hover:bg-primary-light transition-colors">确认发布</button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs text-text-secondary">作品类型</label>
              <select className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" value={aiType} onChange={(e) => setAiType(e.target.value as 'comic' | 'drama')}>
                <option value="comic">漫画</option>
                <option value="drama">短剧</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary">作品梗概</label>
              <textarea className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-primary resize-none" rows={5} placeholder="描述你想创作的故事..." value={synopsis} onChange={(e) => setSynopsis(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-text-secondary">画面风格</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {styles.map((s) => (
                  <button key={s.value} onClick={() => setAiStyle(s.value)} className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs transition-colors ${aiStyle === s.value ? 'border-primary bg-primary/10' : 'border-border bg-bg-card'}`}>
                    <span className="text-lg">{s.icon}</span>
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-text-secondary">生成页数</label>
              <div className="flex items-center gap-3 mt-1">
                <button onClick={() => setAiPageCount(Math.max(2, aiPageCount - 1))} className="w-8 h-8 flex items-center justify-center bg-bg-card border border-border rounded-lg text-lg">-</button>
                <span className="text-lg font-semibold w-6 text-center">{aiPageCount}</span>
                <button onClick={() => setAiPageCount(Math.min(12, aiPageCount + 1))} className="w-8 h-8 flex items-center justify-center bg-bg-card border border-border rounded-lg text-lg">+</button>
                <span className="text-xs text-text-secondary">页分镜</span>
              </div>
            </div>
            <button onClick={submitAI} className="w-full py-3 bg-primary rounded-lg text-sm text-white font-medium hover:bg-primary-light transition-colors">AI 一键生成</button>
          </>
        )}
      </div>
    </div>
  )
}
