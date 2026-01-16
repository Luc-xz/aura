import { request } from '@/http'

export const getModelConfigGroup = (params: any) => {
  return request({
    url: '/api/model-config/group',
    method: 'GET',
    params,
  })
}

export const getModelConfigList = (params: any) => {
  return request({
    url: '/api/model-config/list',
    method: 'GET',
    params,
  })
}

export const createModelConfig = (params: any) => {
  return request({
    url: '/api/model-config',
    method: 'POST',
    data: params,
  })
}

export const updateModelConfig = (id: string, params: any) => {
  return request({
    url: '/api/model-config/' + id,
    method: 'PUT',
    data: params,
  })
}