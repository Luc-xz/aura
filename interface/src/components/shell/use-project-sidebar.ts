import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { getWorkspaceList } from '@/api/workspace'
import type { WorkspaceItem } from '@/api/workspace'
import { useWorkspaceStore } from '@/store'
import { WORKSPACE_CHANGED_EVENT } from './workspace-events'

const STATUS_LABELS: Record<number, string> = {
  0: '进行中',
  1: '暂停',
  2: '已归档',
}

export function useProjectSidebar() {
  const navigate = useNavigate()
  const workspace = useWorkspaceStore((state) => state.workspace)
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)
  const [projects, setProjects] = useState<WorkspaceItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [, res] = await getWorkspaceList({ orderBy: 'updated_at', orderDir: 'DESC' })
    setProjects(res?.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    window.addEventListener(WORKSPACE_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(WORKSPACE_CHANGED_EVENT, refresh)
  }, [refresh])

  const filteredProjects = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return projects
    return projects.filter((item) => item.title.toLowerCase().includes(query))
  }, [keyword, projects])

  const selectProject = useCallback(
    (item: WorkspaceItem) => {
      setWorkspace(item)
      navigate(`/chat?workspaceId=${item.id}`)
    },
    [navigate, setWorkspace]
  )

  return {
    projects,
    filteredProjects,
    keyword,
    setKeyword,
    loading,
    // 原型 03：未进入过推进页时首项默认选中（纯视觉，点击才切换）
    selectedId: workspace?.id ?? filteredProjects[0]?.id ?? null,
    selectProject,
  }
}

export const projectStatusLabel = (status: number) => STATUS_LABELS[status] ?? '未知'
