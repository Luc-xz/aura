import { request } from '@/http'

export const getNotePage = (params: any) => {
  return request({
    url: '/api/note/page',
    method: 'GET',
    params,
  })
}

export const createNote = (data: any) => {
  return request({
    url: '/api/note',
    method: 'POST',
    data,
  })
}
