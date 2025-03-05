import mysql from 'mysql2/promise'
import fs from 'node:fs'
import yaml from 'js-yaml'

class Database {
  static instance = null
  static connection = null

  constructor() {
    // 私有构造函数
  }

  static async getInstance() {
    if (!Database.instance) {
      Database.instance = new Database()
      await Database.instance.initialize()
    }
    return Database.connection
  }

  async initialize() {
    if (!Database.connection) {
      const yamlContent = fs.readFileSync('./config.yaml', 'utf8')
      const config = yaml.load(yamlContent)
      Database.connection = await mysql.createConnection({
        ...config.db,
      })
    }
    return Database.connection
  }
}

export default await Database.getInstance()