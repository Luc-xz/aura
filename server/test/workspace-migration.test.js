import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import pool from '../sql/index.js'

const schema = async () => {
  const [columns] = await pool.query(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('workspace', 'chat')
    ORDER BY TABLE_NAME, ORDINAL_POSITION`)
  const [indexes] = await pool.query(`SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('workspace', 'chat')
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`)
  return { columns, indexes }
}

describe('workspace migration contract', () => {
  it('upgrades populated legacy tables without data loss and matches a fresh init.sql schema', async () => {
    const migration = fs.readFileSync(path.resolve(import.meta.dirname, '../sql/migrations/20260924_alter_workspace_project_fields.sql'), 'utf8')
    const fresh = await schema()
    // Fixture: schema immediately before B1, inside the guarded aura_test DB only.
    await pool.query('DROP TABLE chat, workspace')
    await pool.query(`CREATE TABLE workspace (
      id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, title VARCHAR(255) NOT NULL,
      use_default_model TINYINT(1) NOT NULL DEFAULT 1, model_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`)
    await pool.query(`CREATE TABLE chat (
      id INT AUTO_INCREMENT PRIMARY KEY, workspace_id INT NOT NULL, proposer VARCHAR(255) NOT NULL,
      model_id INT, model_snapshot JSON DEFAULT NULL, content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`)
    await pool.query("INSERT INTO workspace (id, user_id, title, model_id) VALUES (42, 7, 'legacy project', 9)")
    await pool.query("INSERT INTO chat (id, workspace_id, proposer, content) VALUES (43, 42, 'user', 'legacy message')")
    for (const statement of migration.split(';').map((s) => s.trim()).filter(Boolean)) {
      await pool.query(statement)
    }
    const [[project]] = await pool.query('SELECT * FROM workspace WHERE id = 42')
    expect(project).toMatchObject({ id: 42, user_id: 7, title: 'legacy project', model_id: 9, goal: null, description: null, status: 0 })
    expect(project).not.toHaveProperty('chat_count')
    const [[message]] = await pool.query('SELECT * FROM chat WHERE id = 43')
    expect(message).toMatchObject({ workspace_id: 42, content: 'legacy message' })
    expect(await schema()).toEqual(fresh)
    expect(fresh.columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ TABLE_NAME: 'workspace', COLUMN_NAME: 'goal', COLUMN_TYPE: 'varchar(255)' }),
      expect.objectContaining({ TABLE_NAME: 'workspace', COLUMN_NAME: 'description', COLUMN_TYPE: 'varchar(2000)' }),
      expect.objectContaining({ TABLE_NAME: 'workspace', COLUMN_NAME: 'status', COLUMN_TYPE: 'tinyint', COLUMN_DEFAULT: '0' }),
    ]))
  })
})
