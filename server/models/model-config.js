import db from '../sql/index.js'
import { getOffsetPage } from '../utils/pager.js'
import { formatResponse, toSnakeCase } from '../utils/formatter.js'
import { isDefined } from '../utils/index.js'

export default class ModelConfig {
  static filterFields(modelConfig) {
    return formatResponse(modelConfig)
  }

  static async findAll({ user, filters = {}, pagination = null, sort = {} } = {}) {
    if (!user?.id) {
      throw new Error('userId is required')
    }

    let baseSql = `SELECT * FROM model_config WHERE 1=1`
    const params = []

    baseSql += ' AND user_id = ?'
    params.push(user.id)

    // TODO: add filters

    if (pagination) {
      const options = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        allowedSortFields: ['created_at', 'updated_at'],
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

  static async findById(id) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'SELECT * FROM model_config WHERE id = ?'
    const [rows] = await db.query(baseSql, [id])
    return rows[0]
  }

  static async create(user, { providerType, baseUrl, apiKey, modelName, temperature, maxTokens, isActive } = {}) {
    if (!user?.id) {
      throw new Error('userId is required')
    }
    const baseSql = 'INSERT INTO model_config (user_id, provider_type, base_url, api_key, model_name, temperature, max_tokens, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    const [result] = await db.query(baseSql, [user.id, providerType, baseUrl, apiKey, modelName, temperature, maxTokens, isActive])
    return result.insertId
  }

  static async update(id, payload) {
    if (!id) {
      throw new Error('id is required')
    }
    const baseSql = 'UPDATE model_config SET '
    const clause = ' WHERE id = ?'
    let sql = ''
    let params = []
    for (const key in payload) {
      if (['providerType', 'baseUrl', 'apiKey', 'modelName', 'temperature', 'maxTokens', 'isActive'].includes(key) && isDefined(payload[key])) {
        sql += `${toSnakeCase(key)} = ?, `
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
    const baseSql = 'DELETE FROM model_config WHERE id = ?'
    const [result] = await db.query(baseSql, [id])
    return result.affectedRows > 0
  }
}