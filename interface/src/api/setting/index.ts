import { request } from '@/http'

export const getProviderList = () => {
  return request({
    url: '/api/models/provider-list',
    method: 'GET',
  })
}

export const getModelList = (provider: string) => {
  return request({
    url: `/api/models/${provider}/model-list`,
    method: 'GET',
  })
}

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

export const deleteModelConfig = (id: string) => {
  return request({
    url: '/api/model-config/' + id,
    method: 'DELETE',
  })
}