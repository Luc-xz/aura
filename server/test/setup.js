/**
 * Destructive integration tests: ONLY run against explicitly configured test services.
 * MySQL: aura_test tables are recreated per file. Redis: the entire test DB is flushed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, beforeEach, afterAll } from 'vitest'
import { loadTestEnvironment } from './support/environment.js'

// Validate before importing either application's connection singleton.
loadTestEnvironment()
const { default: pool } = await import('../sql/index.js')
const { default: redis } = await import('../utils/redis.js')
let initialized = false

beforeAll(async () => {
  // Fail closed: never treat unavailable services as skipped/passing tests.
  if (redis.status !== 'ready') {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('Test Redis readiness timed out')), 5000)
      const onReady = () => finish()
      const onError = (error) => finish(error)
      function finish(error) {
        clearTimeout(timer)
        redis.off('ready', onReady)
        redis.off('error', onError)
        error ? reject(error) : resolve()
      }
      redis.once('ready', onReady)
      redis.once('error', onError)
    })
  }
  await redis.ping()
  const [[{ database }]] = await pool.query('SELECT DATABASE() AS `database`')
  if (database !== 'aura_test') throw new Error(`Refusing to reset database: ${database}`)

  const [existing] = await pool.execute(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
  )
  const connection = await pool.getConnection()
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const { TABLE_NAME } of existing) {
      await connection.query('DROP TABLE IF EXISTS ??', [TABLE_NAME])
    }
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    connection.release()
  }

  const initSql = fs.readFileSync(path.resolve(import.meta.dirname, '../sql/init.sql'), 'utf8')
  const statements = initSql.split(';').map((s) => s.trim()).filter(
    (s) => s.length > 0 && !s.toUpperCase().startsWith('CREATE DATABASE') && !s.toUpperCase().startsWith('USE')
  )
  for (const statement of statements) await pool.execute(statement)
  initialized = true
  console.log('Test database initialized: aura_test (isolated services)')
})

beforeEach(async () => {
  // Required: user IDs are reused after TRUNCATE, so stale RBAC caches are unsafe.
  await redis.flushdb()
})

afterAll(async () => {
  try {
    if (initialized) {
      const tables = ['user_settings', 'chat', 'model_config', 'note', 'workspace', 'role_menu', 'user_role', 'menu', 'role', 'user']
      const connection = await pool.getConnection()
      try {
        await connection.query('SET FOREIGN_KEY_CHECKS = 0')
        for (const table of tables) await connection.query('TRUNCATE TABLE ??', [table])
      } finally {
        await connection.query('SET FOREIGN_KEY_CHECKS = 1')
        connection.release()
      }
      await redis.flushdb()
    }
  } finally {
    redis.disconnect()
    await pool.end()
  }
})
