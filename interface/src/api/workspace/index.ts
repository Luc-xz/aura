import { request } from '@/http'

export const getWorkspaceList = () => {
  return request({
    url: '/api/workspace',
    method: 'GET',
  })
}

export const getWorkspaceDetail = (id: string) => {
  return request({
    url: `/api/workspace/${id}`,
    method: 'GET',
  })
}

export const createWorkspace = (data: any) => {
  return request({
    url: '/api/workspace',
    method: 'POST',
    data,
  })
}

export const updateWorkspace = (id: string, data: any) => {
  return request({
    url: `/api/workspace/${id}`,
    method: 'PUT',
    data,
  })
}

export const deleteWorkspace = (id: string) => {
  return request({
    url: `/api/workspace/${id}`,
    method: 'DELETE',
  })
}