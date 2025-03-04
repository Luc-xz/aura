import mysql from 'mysql2'
import fs from 'node:fs'
import yaml from 'js-yaml'

class Database {
  constructor() {
    if (Database.instance) {
      return Database.instance
    }

    const yamlContent = fs.readFileSync('./config.yaml', 'utf8')
    const config = yaml.load(yamlContent)
    
    this.connection = mysql.createConnection({
      ...config.db,
    })

    Database.instance = this
  }
}

const db = new Database()
export default db.connection