import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import pool from '../sql/index.js'

const schema = async () => {
  const [columns] = await pool.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_settings'
    ORDER BY ORDINAL_POSITION`)
  const [indexes] = await pool.query(`SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_settings'
    ORDER BY INDEX_NAME, SEQ_IN_INDEX`)
  return { columns, indexes }
}

describe('user settings migration contract', () => {
  it('upgrades the pre-B3 table without data loss and matches a fresh init.sql schema', async () => {
    const migration = fs.readFileSync(path.resolve(import.meta.dirname, '../sql/migrations/20260924_alter_user_settings_default_model.sql'), 'utf8')
    const fresh = await schema()
    // Fixture: schema immediately before B3, inside the guarded aura_test DB only.
    await pool.query('DROP TABLE user_settings')
    await pool.query(`CREATE TABLE user_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      default_model_id INT NOT NULL,
      system_prompt TEXT DEFAULT NULL,
      auto_save_interval INT DEFAULT 0,
      language VARCHAR(20) DEFAULT 'zh-CN',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`)
    await pool.query('INSERT INTO user_settings (user_id, default_model_id) VALUES (7, 9)')
    for (const statement of migration.split(';').map((s) => s.trim()).filter(Boolean)) {
      await pool.query(statement)
    }
    const [[row]] = await pool.query('SELECT * FROM user_settings WHERE user_id = 7')
    expect(row).toMatchObject({ user_id: 7, default_model_id: 9 })
    expect(await schema()).toEqual(fresh)
  })
})
