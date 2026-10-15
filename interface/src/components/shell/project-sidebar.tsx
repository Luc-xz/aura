import { SearchOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import type { WorkspaceItem } from '@/api/workspace'
import { SkeletonCard } from '@/components/ui'
import { formatRelative } from '@/utils/time'
import { projectStatusLabel, useProjectSidebar } from './use-project-sidebar'

export function ProjectSearch({
  keyword,
  onChange,
}: {
  keyword: string
  onChange: (value: string) => void
}) {
  return (
    <label className="search cursor-text">
      <SearchOutlined />
      <input
        value={keyword}
        onChange={(event) => onChange(event.target.value)}
        placeholder="搜索项目"
        className="min-w-0 flex-1 border-0 bg-transparent text-xs text-ink outline-none placeholder:text-placeholder"
      />
    </label>
  )
}

export function ProjectList({
  projects,
  loading,
  selectedId,
  onSelect,
  header,
}: {
  projects: WorkspaceItem[]
  loading: boolean
  selectedId: number | null
  onSelect: (item: WorkspaceItem) => void
  /** 列表顶部固定项（如「项目工作台」入口），加载/空态下仍保留 */
  header?: ReactNode
}) {
  if (loading) {
    return (
      <div className="project-list flex-1 overflow-y-auto">
        {header}
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((key) => (
            <SkeletonCard key={key} rows={2} />
          ))}
        </div>
      </div>
    )
  }

  if (!projects.length) {
    return (
      <div className="project-list flex-1 overflow-y-auto">
        {header}
        <div className="px-2.5 py-5 text-center text-xs text-placeholder">还没有项目</div>
      </div>
    )
  }

  return (
    <div className="project-list flex-1 overflow-y-auto">
      {header}
      {projects.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`project-item text-left ${item.id === selectedId ? 'project-item--active' : ''}`}
          onClick={() => onSelect(item)}>
          <span className="project-item__name">{item.title}</span>
          <span className="project-item__meta">
            {projectStatusLabel(item.status)} · {formatRelative(item.updatedAt)}
          </span>
        </button>
      ))}
    </div>
  )
}
