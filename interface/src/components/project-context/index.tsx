import { Button, Divider, Empty } from 'antd'
import { CheckCircleOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import StatusPill from '@/components/status-pill'
import type { WorkspaceItem } from '@/api/workspace'
import { formatRelative } from '@/utils/time'

interface NoteBrief {
  id: number
  title: string
  updatedAt: string
}

function ContextRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex text-sm leading-6">
      <div className="flex-none w-14 text-gray-500">{label}</div>
      <div className="flex-1 min-w-0 break-words">{children}</div>
    </div>
  )
}

// 沉淀占位：结论/待办/记忆在远期实装
function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-dashed border-ashen rounded p-4 text-center">
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-xs text-gray-400">{description}</div>
    </div>
  )
}

interface ProjectContextProps {
  workspace: WorkspaceItem | null
  notes: NoteBrief[]
  onSaveSessionNote: () => void
}

export default function ProjectContext({ workspace, notes, onSaveSessionNote }: ProjectContextProps) {
  const navigate = useNavigate()

  return (
    <div className="flex-none w-80 h-full border-l border-ashen bg-white overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="title-ter">项目上下文</div>
        {workspace ? (
          <>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className="font-bold text-base truncate"
                  title={workspace.title}>
                  {workspace.title}
                </span>
                <StatusPill status={workspace.status} />
              </div>
              <div className="space-y-1">
                <ContextRow label="目标">{workspace.goal || <span className="text-gray-400">未设置</span>}</ContextRow>
                <ContextRow label="背景">{workspace.description || <span className="text-gray-400">未设置</span>}</ContextRow>
                <ContextRow label="模型">{workspace.modelName || <span className="text-gray-400">未挂载</span>}</ContextRow>
              </div>
              {/* B7 上下文注入透出：仅 goal/description 已注入，笔记注入为远期 */}
              {workspace.goal || workspace.description ? (
                <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                  <CheckCircleOutlined />
                  项目目标与背景已注入对话上下文
                </div>
              ) : (
                <div className="text-xs text-gray-400 mt-2">设置项目目标与背景后，将自动注入对话上下文</div>
              )}
            </div>
            <Divider className="my-2" />

            {/* 关联笔记：会话中保存的笔记按项目沉淀；「存为笔记」为会话级入口 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">关联笔记{notes.length ? `（${notes.length}）` : ''}</span>
                <Button
                  size="small"
                  type="text"
                  icon={<SaveOutlined />}
                  onClick={onSaveSessionNote}>
                  存为笔记
                </Button>
              </div>
              {notes.length ? (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-2 rounded cursor-pointer hover:bg-blue-50"
                    onClick={() => navigate(`/note/edit/${note.id}`)}>
                    <div
                      className="truncate text-sm"
                      title={note.title}>
                      {note.title || '未命名笔记'}
                    </div>
                    <div className="text-xs text-gray-400">{formatRelative(note.updatedAt)}</div>
                  </div>
                ))
              ) : (
                <div className="border border-dashed border-ashen rounded p-3 text-center text-xs text-gray-400">
                  暂无关联笔记，会话中保存的笔记会出现在这里
                </div>
              )}
            </div>

            <PlaceholderSection
              title="项目结论"
              description="功能准备中"
            />
            <PlaceholderSection
              title="待办事项"
              description="功能准备中"
            />
            <PlaceholderSection
              title="项目记忆"
              description="功能准备中"
            />
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="选择项目后展示上下文"
          />
        )}
      </div>
    </div>
  )
}
