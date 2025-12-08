import db from '../sql/index.js'
import { getOffsetPage } from '../utils/pager.js'

export default class Note {
  static filterFields(note) {
    const { content, ...rest } = note
    return rest
  }

  static async findAll({ filters = {}, pagination = {}, sort = {} } = {}) {
    let baseSql = `SELECT * FROM note WHERE 1=1`
    const params = []

    if (filters.createdAt) {
      baseSql += ' AND created_at BETWEEN ? AND ?'
      params.push(filters.createdAt[0], filters.createdAt[1])
    }

    if (filters.updatedAt) {
      baseSql += ' AND updated_at BETWEEN ? AND ?'
      params.push(filters.updatedAt[0], filters.updatedAt[1])
    }

    if (filters.keyword) {
      baseSql += ' AND (title LIKE ? OR description LIKE ?)'
      params.push(`%${filters.keyword}%`, `%${filters.keyword}%`)
    }

    if (pagination) {
      const options = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        allowedSortFields: ['title', 'created_at', 'updated_at'],
        orderBy: sort.orderBy || 'created_at',
        orderDir: sort.orderDir || 'DESC',
      }

      const { rows, page, pageSize, offset, total, totalPage } = await getOffsetPage(baseSql, params, options)
      return {
        rows: rows.map(this.filterFields),
        page,
        pageSize,
        offset,
        total,
        totalPage
      }
    } else {
      const [rows] = await db.query(baseSql, params)
      return rows.map(this.filterFields) || []
    }
  }

  // TODO: complete
  static async findByKeywords(keywords) {

  }

  static async findById(id) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'SELECT * FROM note WHERE id = ?'
    const [rows] = await db.query(baseSql, [id])
    return rows[0]
  }

  static async create({ title, content } = {}) {
    const baseSql = 'INSERT INTO note (title, content) VALUES (?, ?)'
    const [result] = await db.query(baseSql, [title, content])
    return result.insertId
  }

  static async update(id, payload) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'UPDATE note SET '
    const clause = ' WHERE id = ?'
    let sql = ''
    let params = []
    for (const key in payload) {
      if (['title', 'content'].includes(key) && payload[key]) {
        sql += `${key} = ?, `
        params.push(payload[key])
      }
    }
    if (params.length < 1) {
      return true
    }
    // Remove trailing comma and space
    sql = sql.slice(0, -2)

    const finalSql = baseSql + sql + clause
    params.push(id)
    const [result] = await db.query(finalSql, params)
    return result.affectedRows > 0
  }

  static async delete(id) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'DELETE FROM note WHERE id = ?'
    const [result] = await db.query(baseSql, [id])
    return result.affectedRows > 0
  }
}