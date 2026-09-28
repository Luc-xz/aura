import { request } from '@/http'

export interface WorkspaceItem {
  id: number
  title: string
  goal: string | null
  description: string | null
  status: number
  modelId: number | null
  modelName: string | null
  provider: string | null
  chatCount: number
  userId: number
  createdAt: string
  updatedAt: string
}

export interface WorkspaceStats {
  active: number
  paused: number
  archived: number
  advancedThisWeek: number
}

export interface WorkspacePayload {
  title: string
  goal?: string
  description?: string
  status?: number
  modelId?: number | null
}

export interface WorkspaceListParams {
  status?: 0 | 1 | 2
  title?: string
  orderBy?: 'title' | 'created_at' | 'updated_at'
  orderDir?: 'ASC' | 'DESC'
}

export const getWorkspaceList = (params?: WorkspaceListParams) => {
  return request<WorkspaceItem[]>({
    url: '/api/workspace/list',
    method: 'GET',
    params,
  })
}

export const getWorkspaceDetail = (id: number | string) => {
  return request<WorkspaceItem>({
    url: `/api/workspace/${id}`,
    method: 'GET',
  })
}

export const getWorkspaceStats = () => {
  return request<WorkspaceStats>({
    url: '/api/workspace/stats',
    method: 'GET',
  })
}

export const createWorkspace = (data: WorkspacePayload) => {
  return request<WorkspaceItem>({
    url: '/api/workspace',
    method: 'POST',
    data,
  })
}

export const updateWorkspace = (data: WorkspacePayload & { id: number }) => {
  return request<WorkspaceItem>({
    url: `/api/workspace/${data.id}`,
    method: 'PUT',
    data,
  })
}

export const deleteWorkspace = (id: number | string) => {
  return request({
    url: `/api/workspace/${id}`,
    method: 'DELETE',
  })
}
