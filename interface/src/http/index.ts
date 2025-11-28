import service from './request'
import type { AxiosRequestConfig } from 'axios'

export const request = (options: AxiosRequestConfig) => {
  const { method = 'GET', url, data, params } = options

  return new Promise((resolve, reject) => {
    service({
      ...options,
    }).then(res => {
      resolve([null, res])
    }).catch(err => {
      resolve([err, null])
    })
  })
}