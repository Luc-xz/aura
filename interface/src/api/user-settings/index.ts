import { request } from '@/http'

export interface UserSettings {
  defaultModelId: number | null
  systemPrompt: string | null
  autoSaveInterval: number
  language: string
}

export const getUserSettings = () => {
  return request<UserSettings>({
    url: '/api/user/settings',
    method: 'GET',
  })
}

export const updateUserSettings = (data: Partial<UserSettings>) => {
  return request<UserSettings>({
    url: '/api/user/settings',
    method: 'PUT',
    data,
  })
}
