import { request } from '@/http'

export const login = (payload: any) => {
  return request({
    url: '/api/user/login',
    method: 'POST',
    data: payload,
  })
}

export const register = (payload: any) => {
  return request({
    url: '/api/user/register',
    method: 'POST',
    data: payload,
  })
}