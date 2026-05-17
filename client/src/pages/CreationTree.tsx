import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { worksApi } from '../api'
import type { ChapterTreeData, ChapterTreeWork } from '../types'
import BackHeader from '../components/BackHeader'

const NODE_W = 130
const NODE_H = 50
const GAP_Y = 60
const LANE_W = NODE_W + 50 // 泳道宽度 = 节点宽度 + 间距

interface LayoutChapter {
  pageId: number
  workId: number
  pageNumber: number
  description: string
  workTitle: string
  creatorName: string
  x: number
  y: number
  isBranchPoint: boolean
}

interface LayoutEdge {
  from: { x: number; y: number }
  to: { x: number; y: number }
  type: 'chain' | 'branch'
  workId: number
}

const WORK_COLORS = [
  'rgba(139, 92, 246, 0.6)',
  'rgba(59, 130, 246, 0.6)',
  'rgba(16, 185, 129, 0.6)',
  'rgba(245, 158, 11, 0.6)',
  'rgba(236, 72, 153, 0.6)',
  'rgba(6, 182, 212, 0.6)',
  'rgba(249, 115, 22, 0.6)',
]

/**
 * 泳道布局：
 * - 每个作品分配一个泳道（固定宽度，水平排列）
 * - 作品的章节在泳道内垂直排列
 * - fork 作品的章节起始 y = 父作品分叉页的 y + GAP_Y
 * - 只显示 fork_from_page 之后的新章节（跳过复制的前段）
 */
function buildChapterLayout(data: ChapterTreeData): { nodes: LayoutChapter[]; edges: LayoutEdge[] } {
  const nodes: LayoutChapter[] = []
  const edges: LayoutEdge[] = []

  const workMap = new Map<number, ChapterTreeWork>()
  data.works.forEach(w => workMap.set(w.id, w))

  const pagesByWork = new Map<number, typeof data.pages>()
  data.pages.forEach(p => {
    if (!pagesByWork.has(p.work_id)) pagesByWork.set(p.work_id, [])
    pagesByWork.get(p.work_id)!.push(p)
  })

  // 收集 fork 关系
  const childrenOf = new Map<number, ChapterTreeWork[]>()
  data.works.forEach(w => {
    if (w.parent_work_id) {
      if (!childrenOf.has(w.parent_work_id)) childrenOf.set(w.parent_work_id, [])
      childrenOf.get(w.parent_work_id)!.push(w)
    }
  })

  // 泳道分配：root 在中间(0)，分支交替左右排列像树一样展开
  const laneX = new Map<number, number>()
  laneX.set(data.rootWorkId, 0)

  let nextRight = 1
  let nextLeft = -1

  // BFS 分配泳道，每个 parent 的子节点交替放左右
  const visited = new Set<number>([data.rootWorkId])
  const queue = [data.rootWorkId]
  while (queue.length > 0) {
    const wid = queue.shift()!
    const children = childrenOf.get(wid) || []
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!
      if (visited.has(child.id)) continue
      visited.add(child.id)
      // 交替分配左右泳道
      if (i % 2 === 0) {
        laneX.set(child.id, nextRight * LANE_W)
        nextRight++
      } else {
        laneX.set(child.id, nextLeft * LANE_W)
        nextLeft--
      }
      queue.push(child.id)
    }
  }

  // 记录每个作品每页的 y 坐标，供子 fork 查找分叉点 y
  const pageYMap = new Map<string, number>() // key: "workId:pageNumber"

  // 记录分叉点
  const branchPoints = new Set<string>()
  data.works.forEach(w => {
    if (w.parent_work_id && w.fork_from_page) {
      branchPoints.add(`${w.parent_work_id}:${w.fork_from_page}`)
    }
  })

  // 先布局 root 作品（从 y=0 开始）
  function layoutWork(workId: number) {
    const work = workMap.get(workId)
    if (!work) return

    const x = laneX.get(workId) ?? 0
    const pages = pagesByWork.get(workId) || []

    // fork 作品只显示 fork_from_page 之后的新页
    const startPage = work.fork_from_page || 0
    const displayPages = pages.filter(p => p.page_number > startPage)
    if (displayPages.length === 0) return

    // 确定起始 y：如果是 fork 作品，从父作品分叉页 y + GAP_Y 开始
    let baseY = 0
    if (work.parent_work_id && work.fork_from_page) {
      const parentPageY = pageYMap.get(`${work.parent_work_id}:${work.fork_from_page}`)
      if (parentPageY !== undefined) {
        baseY = parentPageY + GAP_Y
      }
    }

    let currentY = baseY

    for (let i = 0; i < displayPages.length; i++) {
      const page = displayPages[i]!
      const isBP = branchPoints.has(`${workId}:${page.page_number}`)

      pageYMap.set(`${workId}:${page.page_number}`, currentY)

      nodes.push({
        pageId: page.id,
        workId,
        pageNumber: page.page_number,
        description: page.description || page.dialogue || '',
        workTitle: work.subtitle || work.title,
        creatorName: work.creator_name,
        x,
        y: currentY,
        isBranchPoint: isBP,
      })

      // 链内连线
      if (i > 0) {
        edges.push({
          from: { x, y: currentY - GAP_Y },
          to: { x, y: currentY },
          type: 'chain',
          workId,
        })
      }

      currentY += GAP_Y
    }

    // 分叉连线：从父作品分叉页连到本作品第一页
    if (work.parent_work_id && work.fork_from_page) {
      const parentX = laneX.get(work.parent_work_id) ?? 0
      const parentY = pageYMap.get(`${work.parent_work_id}:${work.fork_from_page}`)
      if (parentY !== undefined) {
        edges.push({
          from: { x: parentX, y: parentY },
          to: { x, y: baseY },
          type: 'branch',
          workId,
        })
      }
    }
  }

  // 按泳道顺序布局（保证父作品先布局，子作品能找到分叉点 y）
  // BFS 顺序布局（保证父先于子）
  const layoutQueue = [data.rootWorkId]
  const laid = new Set<number>()
  while (layoutQueue.length > 0) {
    const wid = layoutQueue.shift()!
    if (laid.has(wid)) continue
    laid.add(wid)
    layoutWork(wid)
    const children = childrenOf.get(wid) || []
    for (const c of children) layoutQueue.push(c.id)
  }

  return { nodes, edges }
}

export default function CreationTree() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ChapterTreeData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const lastTouchDist = useRef(0)

  useEffect(() => {
    if (!id) return
    worksApi.getTree(id).then(setData)
  }, [id])

  // 初始视角
  useEffect(() => {
    if (!data || !containerRef.current) return
    const { nodes } = buildChapterLayout(data)
    if (nodes.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()

    const maxY = Math.max(...nodes.map(n => n.y))
    const maxX = Math.max(...nodes.map(n => n.x))
    const totalHeight = maxY + NODE_H
    const totalWidth = maxX + NODE_W

    // 居中显示，第 1 章在底部
    const scaleY = totalHeight > 0 ? (rect.height - 100) / totalHeight : 1
    const scaleX = totalWidth > 0 ? (rect.width - 60) / totalWidth : 1
    const fitScale = Math.min(1, Math.min(scaleX, scaleY))

    setPan({
      x: (rect.width - totalWidth * fitScale) / 2 + NODE_W * fitScale / 2,
      y: rect.height - 60,
    })
    setScale(Math.max(0.4, fitScale))
  }, [data])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  const handleMouseUp = useCallback(() => { dragging.current = false }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(s => Math.min(2, Math.max(0.3, s * delta)))
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true
      lastPos.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && dragging.current) {
      const dx = e.touches[0]!.clientX - lastPos.current.x
      const dy = e.touches[0]!.clientY - lastPos.current.y
      lastPos.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }
      setPan(p => ({ x: p.x + dx, y: p.y + dy }))
    } else if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (lastTouchDist.current > 0) {
        const ratio = dist / lastTouchDist.current
        setScale(s => Math.min(2, Math.max(0.3, s * ratio)))
      }
      lastTouchDist.current = dist
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    dragging.current = false
    lastTouchDist.current = 0
  }, [])

  if (!data) return <div className="p-4 text-text-secondary">加载中...</div>

  const { nodes, edges } = buildChapterLayout(data)

  // 颜色分配
  const workIds = [...new Set(nodes.map(n => n.workId))]
  const workColorMap = new Map<number, string>()
  workIds.forEach((wid, i) => workColorMap.set(wid, WORK_COLORS[i % WORK_COLORS.length]!))

  const currentWorkId = id

  return (
    <div className="h-screen flex flex-col">
      <BackHeader title="创作树" />
      <div className="flex-1 relative bg-bg-secondary overflow-hidden">
        <div className="absolute top-3 left-3 z-10 flex gap-1.5">
          <button onClick={() => setScale(s => Math.min(2, s * 1.2))} className="w-8 h-8 bg-bg-card border border-border rounded-lg text-sm flex items-center justify-center">+</button>
          <button onClick={() => setScale(s => Math.max(0.3, s * 0.8))} className="w-8 h-8 bg-bg-card border border-border rounded-lg text-sm flex items-center justify-center">-</button>
        </div>

        {/* 图例 */}
        <div className="absolute top-3 right-3 z-10 bg-bg-card/90 border border-border rounded-lg px-2.5 py-2 text-[10px] space-y-1">
          {data.works.filter(w => workColorMap.has(w.id)).slice(0, 6).map(w => (
            <div key={w.id} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: workColorMap.get(w.id) }} />
              <span className="text-text-secondary truncate max-w-[100px]">{w.subtitle || w.title}</span>
            </div>
          ))}
        </div>

        <div className="absolute bottom-3 left-3 z-10 text-[10px] text-text-secondary bg-bg-card/80 px-2 py-1 rounded">
          拖拽平移 · 滚轮/双指缩放
        </div>

        <div
          ref={containerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
            {/* SVG 连线层 */}
            <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" style={{ width: 1, height: 1 }}>
              {edges.map((edge, i) => {
                const x1 = edge.from.x
                const y1 = -edge.from.y
                const x2 = edge.to.x
                const y2 = -edge.to.y
                const color = workColorMap.get(edge.workId) || WORK_COLORS[0]!

                if (edge.type === 'chain') {
                  return (
                    <line key={i} x1={x1} y1={y1 - NODE_H / 2} x2={x2} y2={y2 + NODE_H / 2}
                      stroke={color} strokeWidth={2} />
                  )
                } else {
                  // 分叉曲线
                  const midY = (y1 + y2) / 2
                  return (
                    <path key={i}
                      d={`M ${x1} ${y1 - NODE_H / 2} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2 + NODE_H / 2}`}
                      fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 2" />
                  )
                }
              })}
            </svg>

            {/* 节点层 */}
            {nodes.map(node => {
              const isCurrentWork = node.workId === currentWorkId
              const color = workColorMap.get(node.workId) || WORK_COLORS[0]!
              const work = data.works.find(w => w.id === node.workId)
              const isNovel = work?.type === 'novel'
              const label = isNovel ? `第${node.pageNumber}章` : `第${node.pageNumber}页`

              return (
                <div
                  key={`${node.workId}-${node.pageNumber}`}
                  data-node
                  onClick={() => navigate(`/work/${node.workId}?from_page=${node.pageNumber}`)}
                  className={`absolute cursor-pointer rounded-lg px-2.5 py-1.5 transition-transform hover:scale-105 ${
                    isCurrentWork ? 'ring-2 ring-primary shadow-lg' : ''
                  } ${node.isBranchPoint ? 'ring-1 ring-amber-400' : ''}`}
                  style={{
                    width: NODE_W,
                    height: NODE_H,
                    left: node.x - NODE_W / 2,
                    top: -node.y - NODE_H / 2,
                    background: `color-mix(in srgb, ${color} 15%, var(--color-bg-card))`,
                    border: `1.5px solid ${color}`,
                  }}
                >
                  <div className="text-[10px] font-medium" style={{ color }}>{label}</div>
                  <div className="text-[9px] text-text-secondary mt-0.5 line-clamp-1">{node.description.substring(0, 20)}</div>
                  <div className="text-[8px] text-text-secondary/60 mt-0.5 truncate">{node.creatorName}</div>
                  {work?.subtitle && node.pageNumber === (work.fork_from_page || 0) + 1 && (
                    <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] font-medium truncate" style={{ color }}>
                      {work.subtitle}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
