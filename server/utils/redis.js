import Redis from 'ioredis'
import { logger } from './logger.js'

const enabled = process.env.REDIS_ENABLED !== 'false'

const redis = enabled
  ? new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    // lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000), // 断线后自动重连，间隔递增，最长 2 秒
    keyPrefix: 'aura:',
  })
  : null

redis?.on('error', (err) => {
  logger.warn(`[redis] connection error: ${err.message}`)
})

export async function cacheGet(key) {
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    return raw && JSON.parse(raw)
  } catch (err) {
    logger.warn(`[redis] GET ${key} failed: ${err.message}`)
    return null
  }
}

export async function cacheSet(key, value, ttl) {
  if (!redis) return null
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl)
  } catch (err) {
    logger.warn(`[redis] SET ${key} failed: ${err.message}`)
  }
}

export async function cacheDel(...keys) {
  if (!redis || keys.length === 0) return
  try {
    await redis.del(...keys)
  } catch (err) {
    logger.warn(`[redis] DEL ${keys.join(',')} failed: ${err.message}`)
  }
}

export async function scanDel(pattern) {
  if (!redis) return
  try {
    const prefix = redis.options?.keyPrefix || ''
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', prefix + pattern, 'COUNT', 100)
      cursor = next
      if (keys.length) {
        await redis.del(...keys.map(k => (k.startsWith(prefix) ? k.slice(prefix.length) : k)))
      }
    } while (cursor !== '0')
  } catch (err) {
    // 失效失败只意味着缓存多活到 TTL，不应拖垮触发失效的写请求
    logger.warn(`[redis] SCAN/DEL ${pattern} failed: ${err.message}`)
  }
}

export default redis