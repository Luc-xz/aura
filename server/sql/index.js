import mysql from 'mysql2/promise'
import fs from 'node:fs'
import yaml from 'js-yaml'

const yamlContent = fs.readFileSync('./config.yaml', 'utf8')
const config = yaml.load(yamlContent)

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10, // 允许同时最多 10 个连接
  queueLimit: 0
})

export default pool