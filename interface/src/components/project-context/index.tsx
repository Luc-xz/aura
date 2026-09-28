import { Divider, Empty } from 'antd'
import StatusPill from '@/components/status-pill'
import type { WorkspaceItem } from '@/api/workspace'

function ContextRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex text-sm leading-6">
      <div className="flex-none w-14 text-gray-500">{label}</div>
      <div className="flex-1 min-w-0 break-words">{children}</div>
    </div>
  )
}

// 会话与沉淀占位：F1 只透出模块位置，关联笔记/结论/待办在 F2/P2 实装
function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-dashed border-ashen rounded p-4 text-center">
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-xs text-gray-400">{description}</div>
    </div>
  )
}

export default function ProjectContext({ workspace }: { workspace: WorkspaceItem | null }) {
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
            </div>
            <Divider className="my-2" />
            <PlaceholderSection
              title="关联笔记"
              description="会话中保存的笔记将按项目沉淀在这里"
            />
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
