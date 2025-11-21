import db from '../sql/index.js'
import { getOffsetPage } from '../utils/pager.js'

class User () {
  filterFields(user) {
    const { password, ...rest } = user
    return rest
  }

  static async findAll({ filters={}, pagination={}, sort={} } = {}) {
    // TODO
  }

  static async findById(id) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'SELECT * FROM user WHERE id = ?'
    const [rows] = await db.query(baseSql, [id])
    return rows[0] && filterFields(rows[0])
  }

  static async create({ name, email, password } = {}) {
    const baseSql = 'INSERT INTO user (name, email, password) VALUES (?, ?, ?)'
    const [result] = await db.query(baseSql, [name, email, password])
    return result.insertId
  }

  static async update(id, payload) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'UPDATE user SET '
    const clause = ' WHERE id = ?'
    let sql = ''
    let params = []
    for (const key in payload) {
      if (['name', 'email', 'password'].includes(key) && payload[key]) {
        sql += `${key} = ?`
        params.push(payload[key])
      }
    }
    if (params.length < 1) {
      // TODO: maybe do something
      return true
    }
    sql = baseSql + sql + clause
    params.push(id)
    const [result] = await db.query(sql, params)
    return result.affectedRows > 0
  }

  static async delete (id) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'DELETE FROM user WHERE id = ?'
    const [result] = await db.query(baseSql, [id])
    return result.affectedRows > 0
  }
}