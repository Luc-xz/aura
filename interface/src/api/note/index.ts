import { request } from '@/http'

export const getNotePage = (params: any) => {
  return request({
    url: '/api/note/page',
    method: 'GET',
    params,
  })
}
