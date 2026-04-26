import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { worksApi } from '../api'
import type { TreeNode } from '../types'
import BackHeader from '../components/BackHeader'

function TreeNodeComponent({ node, isRoot }: { node: TreeNode; isRoot?: boolean }) {
  const navigate = useNavigate()

  return (
    <div className="ml-4">
      <div
        onClick={() => navigate(`/work/${node.id}`)}
        className={`p-3 rounded-lg cursor-pointer hover:scale-[1.01] transition-transform ${
          isRoot ? 'bg-primary/20 border border-primary' : 'bg-bg-card border border-border'
        }`}
      >
        <div className="text-sm font-medium">
          {isRoot ? '🌟 ' : '🔀 '}{node.title}
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-text-secondary">
          <span>{node.creator_avatar}</span>
          <span>{node.creator_name}</span>
        </div>
        {node.fork_count > 0 && (
          <div className="text-[10px] text-accent mt-1">{node.fork_count} 个续写分支</div>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="border-l border-border ml-4 mt-2 space-y-2">
          {node.children.map((child) => (
            <TreeNodeComponent key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CreationTree() {
  const { id } = useParams<{ id: string }>()
  const [tree, setTree] = useState<TreeNode | null>(null)

  useEffect(() => {
    if (!id) return
    worksApi.getTree(Number(id)).then(setTree)
  }, [id])

  if (!tree) return <div className="p-4 text-text-secondary">加载中...</div>

  return (
    <div className="pb-20">
      <BackHeader title="创作树" />
      <div className="px-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold">「{tree.title}」创作树</h3>
          <p className="text-xs text-text-secondary mt-1">点击节点查看作品详情</p>
        </div>
        <TreeNodeComponent node={tree} isRoot />
      </div>
    </div>
  )
}
