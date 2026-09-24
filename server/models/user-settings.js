import db from '../sql/index.js'
import { formatResponse } from '../../shared/utils/formatter.js'

// 无存量行的用户按默认值读取；defaultModelId 为 null 表示未设置默认模型
const DEFAULTS = Object.freeze({
  defaultModelId: null,
  systemPrompt: null,
  autoSaveInterval: 0,
  language: 'zh-CN',
})

export default class UserSettings {
  static filterFields(row) {
    return formatResponse(row)
  }

  static async findByUserId(userId) {
    if (!userId) throw new Error('userId is required')
    const [rows] = await db.query(
      'SELECT default_model_id, system_prompt, auto_save_interval, language FROM user_settings WHERE user_id = ?',
      [userId]
    )
    return rows[0] ? this.filterFields(rows[0]) : { ...DEFAULTS }
  }

  // 部分更新：未提供的字段保留当前值（或默认值）
  static async update(userId, changes) {
    if (!userId) throw new Error('userId is required')
    const merged = { ...(await this.findByUserId(userId)), ...changes }
    const columns = [merged.defaultModelId, merged.systemPrompt, merged.autoSaveInterval, merged.language]
    await db.query(
      `INSERT INTO user_settings (user_id, default_model_id, system_prompt, auto_save_interval, language)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE default_model_id = ?, system_prompt = ?, auto_save_interval = ?, language = ?`,
      [userId, ...columns, ...columns]
    )
    return this.findByUserId(userId)
  }
}
