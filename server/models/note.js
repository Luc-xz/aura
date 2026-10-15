import db from '../sql/index.js'
import { getOffsetPage } from '../utils/pager.js'
import { BadRequest } from '../utils/appError.js'
import { formatResponse, toSnakeCase } from '../../shared/utils/formatter.js'

export default class Note {
  static filterFields(note) {
    const { content, ...rest } = note
    return formatResponse(rest)
  }

  // JOIN workspace 供笔记库展示所属项目；字段全部限定表名，避免与 workspace 同名列歧义
  static sortColumns = { title: 'note.title', created_at: 'note.created_at', updated_at: 'note.updated_at' }

  static async findAll({ user, filters = {}, pagination = null, sort = {} } = {}) {
    if (!user?.id) {
      throw new Error('userId is required')
    }

    let baseSql = `SELECT note.*, workspace.title AS workspace_title
      FROM note LEFT JOIN workspace ON note.workspace_id = workspace.id WHERE 1=1`
    const params = []

    baseSql += ' AND note.user_id = ?'
    params.push(user.id)

    if (filters.createdAt) {
      baseSql += ' AND note.created_at BETWEEN ? AND ?'
      params.push(filters.createdAt[0], filters.createdAt[1])
    }

    if (filters.updatedAt) {
      baseSql += ' AND note.updated_at BETWEEN ? AND ?'
      params.push(filters.updatedAt[0], filters.updatedAt[1])
    }

    if (filters.keyword) {
      baseSql += ' AND (note.title LIKE ? OR note.description LIKE ? OR CAST(note.keywords AS CHAR) LIKE ?)'
      params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`)
    }

    if (filters.workspaceId) {
      baseSql += ' AND note.workspace_id = ?'
      params.push(filters.workspaceId)
    }

    if (sort.orderBy !== undefined && !this.sortColumns[sort.orderBy]) {
      throw BadRequest('invalid note sort')
    }

    if (pagination) {
      const options = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        allowedSortFields: Object.values(this.sortColumns),
        orderBy: this.sortColumns[sort.orderBy] || this.sortColumns.created_at,
        orderDir: sort.orderDir,
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

  static async findByKeywords(user, keyword, { limit = 5 } = {}) {
    if (!user?.id) {
      throw new Error('userId is required')
    }
    if (!keyword || typeof keyword !== 'string') {
      throw new Error('keyword is required')
    }

    const pattern = `%${keyword}%`
    const baseSql = `
    SELECT id, title, description, keywords, updated_at
    FROM note
    WHERE user_id = ?
      AND (
        title LIKE ?
        OR description LIKE ?
        OR CAST(keywords AS CHAR) LIKE ?
      )
    ORDER BY updated_at DESC
    LIMIT ?`
    const [rows] = await db.query(baseSql, [user.id, pattern, pattern, pattern, limit])
    return rows.map(this.filterFields)
  }

  static async findById(id) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'SELECT * FROM note WHERE id = ?'
    const [rows] = await db.query(baseSql, [id])
    return rows[0]
  }

  static async findByIdAndUser(id, user) {
    if (!id) {
      throw new Error('id is required')
    }
    if (!user?.id) {
      throw new Error('userId is required')
    }
    const [rows] = await db.query(
      'SELECT * FROM note WHERE id = ? AND user_id = ?',
      [id, user.id]
    )
    return rows[0] || null
  }

  static async create(user, { title, content, description, keywords, workspaceId, sourceChatId } = {}) {
    if (!user?.id) {
      throw new Error('userId is required')
    }
    const baseSql = `INSERT INTO note
      (user_id, workspace_id, source_chat_id, title, content, description, keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    const [result] = await db.query(baseSql, [
      user.id, workspaceId ?? null, sourceChatId ?? null,
      title, content, description, keywords ? JSON.stringify(keywords) : null,
    ])
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
      if (['title', 'content', 'description', 'keywords', 'workspaceId', 'sourceChatId'].includes(key) && payload[key] !== undefined) {
        const value = key === 'keywords' ? JSON.stringify(payload[key]) : payload[key]
        sql += `${toSnakeCase(key)} = ?, `
        params.push(value)
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