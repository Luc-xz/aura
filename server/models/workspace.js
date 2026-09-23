import db from '../sql/index.js'
import { BadRequest, Conflict, NotFound } from '../utils/appError.js'
import { formatResponse } from '../../shared/utils/formatter.js'

export default class Workspace {
  static filterFields(workspace) {
    return formatResponse(workspace)
  }

  // Restrict the model join to public display fields; never return credentials.
  static detailSelect = `SELECT workspace.*, model_config.model_name, model_config.provider,
    (SELECT COUNT(*) FROM chat WHERE chat.workspace_id = workspace.id) AS chat_count
    FROM workspace LEFT JOIN model_config ON workspace.model_id = model_config.id`

  static async findWithDetails({ user, filters = {}, pagination = null, sort = {} } = {}) {
    if (!user?.id) throw new Error('userId is required')
    let where = ' WHERE workspace.user_id = ?'
    const params = [user.id]
    for (const [field, column] of [['createdAt', 'created_at'], ['updatedAt', 'updated_at']]) {
      if (filters[field]) {
        where += ' AND workspace.' + column + ' BETWEEN ? AND ?'
        params.push(...filters[field])
      }
    }
    if (filters.status !== undefined) {
      where += ' AND workspace.status = ?'
      params.push(filters.status)
    }
    if (filters.title) {
      where += " AND workspace.title LIKE ? ESCAPE '!'"
      params.push('%' + filters.title.replace(/[!%_]/g, '!$&') + '%')
    }
    const orderBy = sort.orderBy ?? 'updated_at'
    const orderDir = (sort.orderDir ?? 'DESC').toUpperCase()
    if (!['title', 'created_at', 'updated_at'].includes(orderBy) || !['ASC', 'DESC'].includes(orderDir)) {
      throw BadRequest('invalid workspace sort')
    }
    const query = this.detailSelect + where + ' ORDER BY workspace.' + orderBy + ' ' + orderDir + ', workspace.id DESC'
    if (!pagination) {
      const [rows] = await db.query(query, params)
      return rows.map(this.filterFields)
    }
    const page = Math.max(1, Math.trunc(Number(pagination.page) || 1))
    const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(pagination.pageSize) || 10)))
    const offset = (page - 1) * pageSize
    const [rows] = await db.query(query + ' LIMIT ? OFFSET ?', [...params, pageSize, offset])
    // Explicit count avoids the shared pager's SELECT/FROM regex on nested queries.
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM workspace' + where, params)
    return { rows: rows.map(this.filterFields), page, pageSize, offset, total, totalPage: Math.ceil(total / pageSize) }
  }

  static async findById(id) {
    if (!id) throw new Error('id is required')
    const [rows] = await db.query(this.detailSelect + ' WHERE workspace.id = ?', [id])
    return rows[0] && this.filterFields(rows[0])
  }

  static async stats(user) {
    if (!user?.id) throw new Error('userId is required')
    const [[row]] = await db.query(`SELECT
      COALESCE(SUM(status = 0), 0) AS active,
      COALESCE(SUM(status = 1), 0) AS paused,
      COALESCE(SUM(status = 2), 0) AS archived,
      COALESCE(SUM(EXISTS(SELECT 1 FROM chat WHERE chat.workspace_id = workspace.id
        AND chat.created_at >= NOW() - INTERVAL 7 DAY AND chat.created_at <= NOW())), 0) AS advancedThisWeek
      FROM workspace WHERE user_id = ?`, [user.id])
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]))
  }

  static async create(user, { title, goal = null, description = null, status = 0, modelId = null } = {}) {
    if (!user?.id) throw new Error('userId is required')
    const [result] = await db.query(
      'INSERT INTO workspace (user_id, title, goal, description, status, model_id) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, title, goal, description, status, modelId]
    )
    return result.insertId
  }

  static async update(id, payload) {
    if (!id) throw new Error('id is required')
    const fields = { title: 'title', goal: 'goal', description: 'description', status: 'status', modelId: 'model_id' }
    const entries = Object.entries(fields).filter(([key]) => payload[key] !== undefined)
    if (!entries.length) return false
    const assignments = entries.map(([, column]) => column + ' = ?').join(', ')
    const [result] = await db.query('UPDATE workspace SET ' + assignments + ' WHERE id = ?', [
      ...entries.map(([key]) => payload[key]), id,
    ])
    return result.affectedRows > 0
  }

  static async delete(id) {
    if (!id) throw new Error('id is required')
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      // Check lifecycle under the same lock as deletion, not just in the route.
      const [[workspace]] = await connection.query('SELECT status FROM workspace WHERE id = ? FOR UPDATE', [id])
      if (!workspace) throw NotFound('workspace not found')
      if (workspace.status !== 2) throw Conflict('archive the workspace before deleting it')
      await connection.query('DELETE FROM note WHERE workspace_id = ?', [id])
      await connection.query('DELETE FROM chat WHERE workspace_id = ?', [id])
      await connection.query('DELETE FROM workspace WHERE id = ?', [id])
      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}
