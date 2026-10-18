import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pool from '../sql/index.js'
import { readMigrationStatements } from './support/migrations.js'
import { authHeader, getRequest, registerAndLogin, registerAndLoginAdmin } from './helpers.js'

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ROUND_TRIP_WINDOW_MS = 5000
const TEST_DATABASE = 'aura_test'
const TIME_TABLES = [
  'user', 'role', 'user_role', 'menu', 'role_menu',
  'workspace', 'chat', 'note', 'model_config', 'user_settings',
]
const FIXTURE_TABLES = ['datetime_utc_zero_fixture', 'datetime_utc_plus8_fixture']

let request

beforeAll(async () => {
  request = await getRequest()
})

afterAll(async () => {
  for (const table of FIXTURE_TABLES) await pool.query('DROP TABLE IF EXISTS ??', [table])
})

const createWorkspace = async (token, title = 'utc project') => {
  const res = await request.post('/api/workspace').set(authHeader(token)).send({ title })
  expect(res.status).toBe(200)
  return res.body.data
}

const createNote = async (token, title = 'utc note') => {
  const res = await request.post('/api/note').set(authHeader(token)).send({ title, content: 'hello' })
  expect(res.status).toBe(200)
  return res.body.data?.id ?? res.body.data
}

const expectFreshIsoUtc = (value, tolerance = ROUND_TRIP_WINDOW_MS) => {
  expect(value).toMatch(ISO_UTC)
  const drift = Date.now() - Date.parse(value)
  expect(drift).toBeGreaterThanOrEqual(0)
  expect(drift).toBeLessThanOrEqual(tolerance)
}

const storedLiteral = async (table, column, id) => {
  const [[row]] = await pool.query(`SELECT DATE_FORMAT(${column}, '%Y-%m-%d %H:%i:%s.%f') AS literal FROM ${table} WHERE id = ?`, [id])
  return row.literal
}

const toUtcLiteral = (iso) => new Date(iso).toISOString().slice(0, 23).replace('T', ' ')

const withSessionConnection = async (run) => {
  const connection = await pool.getConnection()
  try {
    return await run(connection)
  } finally {
    try {
      await connection.query("SET time_zone = '+00:00'")
    } finally {
      connection.release()
    }
  }
}

describe('连接层：每个池化连接都固定为 UTC', () => {
  it('会话时区为 +00:00，且 NOW() 与 UTC_TIMESTAMP() 一致', async () => {
    const results = await Promise.all([1, 2, 3].map(() => withSessionConnection((connection) => connection.query(
      'SELECT @@session.time_zone AS tz, NOW(3) AS serverNow, UTC_TIMESTAMP(3) AS utcNow'
    ))))
    for (const [[row]] of results) {
      expect(row.tz).toBe('+00:00')
      expect(row.serverNow).toBeInstanceOf(Date)
      expect(row.serverNow.getTime()).toBe(row.utcNow.getTime())
    }
  })
})

describe('数据库 schema：时间列统一为 DATETIME(3) 且默认值取 UTC', () => {
  it('10 张表的 created_at / updated_at 都是 datetime(3)，带 CURRENT_TIMESTAMP(3) 默认值', async () => {
    const [columns] = await pool.query(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, DATETIME_PRECISION, COLUMN_DEFAULT, EXTRA
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('created_at', 'updated_at')
      ORDER BY TABLE_NAME, COLUMN_NAME`)

    expect(columns).toHaveLength(TIME_TABLES.length * 2)
    expect([...new Set(columns.map((column) => column.TABLE_NAME))].sort()).toEqual([...TIME_TABLES].sort())
    for (const column of columns) {
      expect(column.DATA_TYPE).toBe('datetime')
      expect(Number(column.DATETIME_PRECISION)).toBe(3)
      expect(column.COLUMN_TYPE).toBe('datetime(3)')
      expect(column.COLUMN_DEFAULT).toBe('CURRENT_TIMESTAMP(3)')
      if (column.COLUMN_NAME === 'updated_at') {
        expect(column.EXTRA).toContain('on update CURRENT_TIMESTAMP(3)')
      }
    }
  })
})

describe('API 契约：时间字段是带 Z 的 ISO 8601', () => {
  it('workspace 的 createdAt / updatedAt 都是 ISO 8601 UTC', async () => {
    const user = await registerAndLogin()
    const workspace = await createWorkspace(user.token)
    expect(workspace.createdAt).toMatch(ISO_UTC)
    expect(workspace.updatedAt).toMatch(ISO_UTC)

    const list = await request.get('/api/workspace/list').set(authHeader(user.token))
    const listed = list.body.data.find((row) => row.id === workspace.id)
    expect(listed.createdAt).toMatch(ISO_UTC)
    expect(listed.updatedAt).toMatch(ISO_UTC)
  })

  it('note 与 chat 的 createdAt 都是 ISO 8601 UTC', async () => {
    const user = await registerAndLogin()
    const workspace = await createWorkspace(user.token, 'chat project')
    const noteId = await createNote(user.token)
    await pool.query("INSERT INTO chat (workspace_id, proposer, content) VALUES (?, 'user', 'hello')", [workspace.id])

    const notePage = await request.get('/api/note/page').set(authHeader(user.token))
    const note = notePage.body.data.rows.find((row) => row.id === noteId)
    expect(note.createdAt).toMatch(ISO_UTC)
    expect(note.updatedAt).toMatch(ISO_UTC)

    const chatList = await request.get(`/api/chat/list/${workspace.id}`).set(authHeader(user.token))
    expect(chatList.status).toBe(200)
    expect(chatList.body.data[0].createdAt).toMatch(ISO_UTC)
  })

  it('用户管理列表的 createdAt 同样是 ISO 8601 UTC', async () => {
    const admin = await registerAndLoginAdmin()
    const page = await request.get('/api/user/page').set(authHeader(admin.token))
    expect(page.status).toBe(200)
    expect(page.body.data.rows.length).toBeGreaterThan(0)
    for (const row of page.body.data.rows) expect(row.createdAt).toMatch(ISO_UTC)
  })
})

describe('往返一致性：写入 → 读回无偏移', () => {
  it('workspace 写入后立刻读回，时间差在允许窗口内，且库内字面值就是 UTC', async () => {
    const user = await registerAndLogin()
    const workspace = await createWorkspace(user.token, 'round trip project')

    expectFreshIsoUtc(workspace.createdAt)
    expectFreshIsoUtc(workspace.updatedAt)

    expect((await storedLiteral('workspace', 'created_at', workspace.id)).slice(0, 23))
      .toBe(toUtcLiteral(workspace.createdAt))
    expect((await storedLiteral('workspace', 'updated_at', workspace.id)).slice(0, 23))
      .toBe(toUtcLiteral(workspace.updatedAt))

    const reread = await request.get(`/api/workspace/${workspace.id}`).set(authHeader(user.token))
    expect(reread.status).toBe(200)
    expect(reread.body.data.createdAt).toBe(workspace.createdAt)
  })

  it('note 与 chat 的 DEFAULT CURRENT_TIMESTAMP(3) 只影响毫秒，不引入时区偏移', async () => {
    const user = await registerAndLogin()
    const workspace = await createWorkspace(user.token, 'round trip chat')
    const noteId = await createNote(user.token, 'round trip note')
    await pool.query("INSERT INTO chat (workspace_id, proposer, content) VALUES (?, 'user', 'hi')", [workspace.id])

    const notePage = await request.get('/api/note/page').set(authHeader(user.token))
    const savedNote = notePage.body.data.rows.find((row) => row.id === noteId)
    expectFreshIsoUtc(savedNote.createdAt)
    expect((await storedLiteral('note', 'created_at', noteId)).slice(0, 23)).toBe(toUtcLiteral(savedNote.createdAt))

    const chatList = await request.get(`/api/chat/list/${workspace.id}`).set(authHeader(user.token))
    const savedChat = chatList.body.data[0]
    expectFreshIsoUtc(savedChat.createdAt)
    expect((await storedLiteral('chat', 'created_at', savedChat.id)).slice(0, 23)).toBe(toUtcLiteral(savedChat.createdAt))
  })
})

describe('范围过滤：ISO 与遗留 UTC 字面值都能正确比较', () => {
  const rangeAround = (iso, spanMs = 60000) => [
    new Date(Date.parse(iso) - spanMs).toISOString(),
    new Date(Date.parse(iso) + spanMs).toISOString(),
  ]

  it('ISO 8601 范围参数能命中记录（不再被 MySQL 隐式截断）', async () => {
    const user = await registerAndLogin()
    const workspace = await createWorkspace(user.token, 'iso range project')
    const [start, end] = rangeAround(workspace.createdAt)

    const res = await request
      .get('/api/workspace/list')
      .query({ createdAt: `${start},${end}` })
      .set(authHeader(user.token))
    expect(res.status).toBe(200)
    expect(res.body.data.map((row) => row.id)).toContain(workspace.id)
  })

  it('遗留的无时区字面值按 UTC 语义透传，同样命中记录', async () => {
    const user = await registerAndLogin()
    const workspace = await createWorkspace(user.token, 'legacy range project')
    const [start, end] = rangeAround(workspace.createdAt)
    const legacy = `${start.slice(0, 19).replace('T', ' ')},${end.slice(0, 19).replace('T', ' ')}`

    const res = await request.get('/api/workspace/list').query({ createdAt: legacy }).set(authHeader(user.token))
    expect(res.status).toBe(200)
    expect(res.body.data.map((row) => row.id)).toContain(workspace.id)
  })

  it('note 的范围过滤走同一套规范化后仍然可用', async () => {
    const user = await registerAndLogin()
    const noteId = await createNote(user.token, 'range note')
    const notePage = await request.get('/api/note/page').set(authHeader(user.token))
    const saved = notePage.body.data.rows.find((row) => row.id === noteId)
    const [start, end] = rangeAround(saved.createdAt)

    const res = await request
      .get('/api/note/page')
      .query({ createdAt: `${start},${end}` })
      .set(authHeader(user.token))
    expect(res.status).toBe(200)
    expect(res.body.data.rows.map((row) => row.id)).toContain(noteId)
  })

  it('非法范围参数返回 400，而不是把脏字符串交给 SQL', async () => {
    const user = await registerAndLogin()
    for (const value of ['not-a-date,2026-01-01', '2026-01-01', '2026-01-01,']) {
      const res = await request.get('/api/workspace/list').query({ createdAt: value }).set(authHeader(user.token))
      expect(res.status).toBe(400)
      expect(res.body.message).toBe('invalid date range')
    }
  })
})

describe('迁移脚本：TIMESTAMP → DATETIME(3) 不改变 UTC 语义', () => {
  const LEGACY_UTC = '2021-03-04 05:06:07'
  const LEGACY_UTC_MS = Date.parse('2021-03-04T05:06:07Z')
  const retargeted = readMigrationStatements(
    path.resolve(import.meta.dirname, '../sql/migrations/20261018_datetime_utc.sql'),
    TEST_DATABASE
  )
  const useStatement = retargeted.find((statement) => /\bUSE\s+`/i.test(statement))
  const userAlter = retargeted.find((statement) => /ALTER TABLE user\b/.test(statement))
  const alterFor = (table) => userAlter.replace('ALTER TABLE user', 'ALTER TABLE ' + table)

  const createFixture = async (connection, table) => {
    await connection.query('DROP TABLE IF EXISTS ??', [table])
    await connection.query(`CREATE TABLE \`${table}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`)
    await connection.query('INSERT INTO ?? (id, created_at) VALUES (1, ?)', [table, LEGACY_UTC])
  }

  it('真实迁移文件可重复执行且列结构不变', async () => {
    await withSessionConnection(async (connection) => {
      expect(userAlter).toBeTruthy()
      expect(useStatement).toBeTruthy()
      expect(useStatement).toContain('USE `' + TEST_DATABASE + '`')
      const setIndex = retargeted.findIndex((statement) => /SET time_zone/.test(statement))
      const firstAlterIndex = retargeted.findIndex((statement) => /ALTER TABLE/.test(statement))
      expect(retargeted.indexOf(useStatement)).toBeLessThan(setIndex)
      expect(setIndex).toBeLessThan(firstAlterIndex)
      expect(retargeted[setIndex]).toContain("SET time_zone = '+00:00'")

      for (let pass = 0; pass < 2; pass += 1) {
        for (const statement of retargeted) await connection.query(statement)
      }
      const [columns] = await connection.query(`SELECT TABLE_NAME, DATA_TYPE, DATETIME_PRECISION
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('created_at', 'updated_at')
        ORDER BY TABLE_NAME, COLUMN_NAME`)
      expect(columns).toHaveLength(TIME_TABLES.length * 2)
      for (const column of columns) {
        expect(column.DATA_TYPE).toBe('datetime')
        expect(Number(column.DATETIME_PRECISION)).toBe(3)
      }
    })
  })

  it('会话固定为 UTC 时，存量 UTC 时刻零偏移', async () => {
    const table = FIXTURE_TABLES[0]
    await withSessionConnection(async (connection) => {
      try {
        await connection.query("SET time_zone = '+00:00'")
        await createFixture(connection, table)

        const [[legacy]] = await connection.query('SELECT created_at FROM ?? WHERE id = 1', [table])
        expect(legacy.created_at.getTime()).toBe(LEGACY_UTC_MS)

        await connection.query(alterFor(table))

        const [[column]] = await connection.query(`SELECT DATA_TYPE, DATETIME_PRECISION FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'created_at'`, [table])
        expect(column.DATA_TYPE).toBe('datetime')
        expect(Number(column.DATETIME_PRECISION)).toBe(3)

        const [[migrated]] = await connection.query('SELECT created_at FROM ?? WHERE id = 1', [table])
        expect(migrated.created_at.getTime()).toBe(LEGACY_UTC_MS)
      } finally {
        await connection.query('DROP TABLE IF EXISTS ??', [table])
      }
    })
  })

  it('会话不固定为 UTC 时存量值偏移 8 小时（这就是脚本首句 SET 的理由）', async () => {
    const table = FIXTURE_TABLES[1]
    await withSessionConnection(async (connection) => {
      try {
        await connection.query("SET time_zone = '+00:00'")
        await createFixture(connection, table)

        await connection.query("SET time_zone = '+08:00'")
        await connection.query(alterFor(table))

        const [[migrated]] = await connection.query('SELECT created_at FROM ?? WHERE id = 1', [table])
        expect(migrated.created_at.getTime() - LEGACY_UTC_MS).toBe(8 * 3600 * 1000)
      } finally {
        await connection.query('DROP TABLE IF EXISTS ??', [table])
      }
    })
  })
})
