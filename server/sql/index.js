import mysql from 'mysql2/promise'
import fs from 'node:fs'
import yaml from 'js-yaml'

const yamlContent = fs.readFileSync('./config.yaml', 'utf8')
const config = yaml.load(yamlContent)

const dbName = process.env.NODE_ENV === 'test' ? 'aura_test' : config.db.database

const pool = mysql.createPool({
  ...config.db,
  database: dbName,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10, // 允许同时最多 10 个连接
  queueLimit: 0
})

export default pool