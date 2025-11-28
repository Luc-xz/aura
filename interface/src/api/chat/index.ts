import { request } from '@/http'

export const getChatListByWorkspaceId = (workspaceId: string) => {
  return request({
    url: `/api/chat/list/${workspaceId}`,
    method: 'GET',
  })
}

export const chatToWorkspace = (workspaceId: string, options = {}) => {
  return request({
    url: `/api/chat/${workspaceId}`,
    method: 'POST',
    data: options,
  })
}