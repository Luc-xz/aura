import { useNavigate } from 'react-router'
import { CheckCircleOutlined } from '@ant-design/icons'
import { Pill } from '@/components/ui'
import type { WorkspaceItem } from '@/api/workspace'
import { formatRelative } from '@/utils/time'

interface NoteBrief {
  id: number
  title: string
  description?: string | null
  content?: string | null
  updatedAt: string
}

const STATUS_TONE: Record<number, { tone: 'active' | 'paused' | 'archived'; label: string }> = {
  0: { tone: 'active', label: '进行中' },
  1: { tone: 'paused', label: '已暂停' },
  2: { tone: 'archived', label: '已归档' },
}

const excerpt = (text?: string | null, max = 48) => {
  const plain = (text || '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max)}…` : plain || '（无摘要）'
}

interface ProjectContextProps {
  workspace: WorkspaceItem | null
  notes: NoteBrief[]
  onSaveSessionNote: () => void
  onOpenSettings: () => void
}

// 右栏「上下文沉淀」（原型 06/07 col-right）：项目卡 / 会话占位 / 已沉淀结论（关联笔记映射为米色结论卡）
export default function ProjectContext({ workspace, notes, onSaveSessionNote, onOpenSettings }: ProjectContextProps) {
  const navigate = useNavigate()
  const status = workspace ? STATUS_TONE[workspace.status] ?? STATUS_TONE[2] : null

  return (
    <aside className="col-right">
      <div className="row-between">
        <span className="t-h3">上下文沉淀</span>
      </div>

      {workspace && status ? (
        <>
          <div className="side-card">
            <div className="row-between">
              <Pill
                tone={status.tone}
                size="sm">
                {status.label}
              </Pill>
              <span className="t-xs t-placeholder">{workspace.modelName || '未挂载模型'}</span>
            </div>
            <span className="t-body w-medium">{workspace.goal ? `目标：${workspace.goal}` : '未设置项目目标'}</span>
            <span className="t-sm t-muted">{workspace.description || '暂无背景描述'}</span>
            <span className="t-xs t-placeholder">
              创建于 {workspace.createdAt?.slice(0, 10) || '—'} · {workspace.chatCount} 条对话
            </span>
            {/* B7 上下文注入透出：仅 goal/description 已注入，笔记注入为远期 */}
            {workspace.goal || workspace.description ? (
              <span className="t-xs t-success flex items-center gap-1">
                <CheckCircleOutlined />
                项目目标与背景已注入对话上下文
              </span>
            ) : (
              <span className="t-xs t-placeholder">设置项目目标与背景后，将自动注入对话上下文</span>
            )}
          </div>

          {/* 项目 = 单会话（多会话拆分为远期）：零对话时按原型 07 显示「新会话」 */}
          <div className="group-title">会话</div>
          <div className="session-item session-item--active">
            <span className="session-item__title">{workspace.chatCount > 0 ? workspace.title : '新会话'}</span>
            <span className="session-item__meta">{workspace.chatCount > 0 ? `共 ${workspace.chatCount} 条对话` : '刚刚 · 0 条'}</span>
          </div>

          <div className="group-title">已沉淀结论</div>
          {notes.length ? (
            notes.map((note) => (
              <button
                type="button"
                key={note.id}
                className="conclusion"
                title="打开笔记"
                onClick={() => navigate(`/note/edit/${note.id}`)}>
                <span className="conclusion__title">{note.title || '未命名笔记'}</span>
                <span className="conclusion__body">{excerpt(note.description || note.content)}</span>
                <span className="conclusion__source">来自笔记 · {formatRelative(note.updatedAt)}</span>
              </button>
            ))
          ) : (
            <div
              className="side-card side-card--plain items-center px-3.5 py-5 text-center"
              style={{ padding: '20px 14px' }}>
              <span className="t-sm t-muted">还没有沉淀结论</span>
              <span className="t-xs t-placeholder">推进过程中可随时把关键结论存为笔记</span>
            </div>
          )}
        </>
      ) : (
        <div
          className="side-card side-card--plain items-center px-3.5 py-5 text-center"
          style={{ padding: '20px 14px' }}>
          <span className="t-sm t-muted">选择项目后展示上下文</span>
          <span className="t-xs t-placeholder">在左侧列表中选择一个项目开始推进</span>
        </div>
      )}

      <div className="side-foot">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={!workspace}
          onClick={onSaveSessionNote}>
          存为笔记
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={!workspace}
          onClick={onOpenSettings}>
          项目设置
        </button>
      </div>
    </aside>
  )
}
