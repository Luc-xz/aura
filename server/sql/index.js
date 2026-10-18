import mysql from 'mysql2/promise'
import { logger } from '../utils/logger.js'

const dbName = process.env.NODE_ENV === 'test' ? 'aura_test' : process.env.DB_NAME || 'aura'

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  database: dbName,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10, // 允许同时最多 10 个连接
  queueLimit: 0,
  timezone: 'Z'
})

pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) {
      logger.error('[sql] failed to pin session time_zone to UTC:', error.message)
      connection.destroy()
    }
  })
})

export default pool
