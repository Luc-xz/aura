import { request } from '@/http'

export const getNotePage = (params: any) => {
  return request({
    url: '/api/note/page',
    method: 'GET',
    params,
  })
}

export const getNoteById = (id: string) => {
  return request({
    url: `/api/note/${id}`,
    method: 'GET',
  })
}

export const createNote = (data: any) => {
  return request({
    url: '/api/note',
    method: 'POST',
    data,
  })
}

export const updateNote = (data: any) => {
  return request({
    url: `/api/note/${data.id}`,
    method: 'PUT',
    data,
  })
}
