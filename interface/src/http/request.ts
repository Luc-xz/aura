import axios from 'axios'
import { handleNetworkError, handleErrMsg } from './handler'
const env = import.meta.env

const service = axios.create({
  baseURL: env.VITE_APP_BASE_API,
})

service.interceptors.request.use(config => {
  // console.log('request-interceptors', config)
  return config
})

service.interceptors.response.use(response => {
  // console.log('response-interceptors', response)
  if (response.status !== 200) {
    handleNetworkError(response.status)
    return Promise.reject(response.data)
  }

  return response.data
}, error => {
  return Promise.reject(error)
})

export default service
