import { beforeAll, beforeEach, describe, it, expect } from 'vitest'
import pool from '../sql/index.js'
import { getRequest, registerAndLogin, registerAndLoginAdmin, authHeader, cleanTable } from './helpers.js'

let request, owner
beforeAll(async () => { request = await getRequest() })
beforeEach(async () => {
  for (const table of ['user_settings', 'chat', 'note', 'model_config', 'workspace', 'user_role', 'user']) await cleanTable(table)
  owner = await registerAndLogin()
})
const create = async (payload = {}, user = owner) => {
  const res = await request.post('/api/workspace').set(authHeader(user.token)).send({ title: 'project', ...payload })
  expect(res.status).toBe(200)
  return res.body.data
}
const list = async (query = {}, user = owner) => {
  const res = await request.get('/api/workspace/list').query(query).set(authHeader(user.token))
  expect(res.status).toBe(200)
  return res.body.data
}
const detail = (id, user = owner) => request.get(`/api/workspace/${id}`).set(authHeader(user.token))

describe('project field contracts', () => {
  it('accepts exact length limits and restores status=0 without overwriting omitted fields', async () => {
    const project = await create({ goal: 'g'.repeat(255), description: 'd'.repeat(2000), status: 2 })
    const res = await request.put(`/api/workspace/${project.id}`).set(authHeader(owner.token)).send({ status: 0 })
    expect(res.status).toBe(200)
    expect((await list())[0]).toMatchObject({ goal: 'g'.repeat(255), description: 'd'.repeat(2000), status: 0 })
  })

  it('explicit null and empty text clear fields; modelId null detaches a model', async () => {
    const model = await request.post('/api/model-config').set(authHeader(owner.token)).send({ provider: 'openai', modelName: 'test' })
    expect(model.status).toBe(200)
    const project = await create({ goal: 'old goal', description: 'old background', modelId: model.body.data?.id ?? model.body.data })
    expect(project.modelId).toBe(model.body.data?.id ?? model.body.data)
    const res = await request.put(`/api/workspace/${project.id}`).set(authHeader(owner.token)).send({ goal: null, description: '', modelId: null })
    expect(res.status).toBe(200)
    expect((await list())[0]).toMatchObject({ title: 'project', goal: null, description: null, modelId: null })
  })

  it.each([-1, 3, 1.5, '0', true, null])('rejects invalid numeric status %j on create and update', async (status) => {
    const project = await create()
    for (const [method, url, body] of [
      ['post', '/api/workspace', { title: 'bad', status }],
      ['put', `/api/workspace/${project.id}`, { status }],
    ]) {
      expect((await request[method](url).set(authHeader(owner.token)).send(body)).status).toBe(400)
    }
  })

  it.each([{ goal: 42 }, { description: [] }, { goal: 'x'.repeat(256) }, { description: 'x'.repeat(2001) }, { title: '' }, { title: '   ' }, { modelId: 0 }])('rejects invalid update fields %#', async (payload) => {
    const project = await create()
    expect((await request.put(`/api/workspace/${project.id}`).set(authHeader(owner.token)).send(payload)).status).toBe(400)
  })
})

describe('project reads, counts and ordering', () => {
  it('detail returns fields and live message count without model secrets', async () => {
    const model = await request.post('/api/model-config').set(authHeader(owner.token)).send({ provider: 'openai', modelName: 'test', apiKey: 'test-only-secret' })
    expect(model.status).toBe(200)
    const project = await create({ goal: 'target', description: 'context', status: 1, modelId: model.body.data?.id ?? model.body.data })
    await pool.query("INSERT INTO chat (workspace_id, proposer, content) VALUES (?, 'user', 'question'), (?, 'assistant', 'answer')", [project.id, project.id])
    const res = await detail(project.id)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ id: project.id, goal: 'target', description: 'context', status: 1, chatCount: 2, modelName: 'test', provider: 'openai' })
    expect(res.body.data).not.toHaveProperty('apiKey')
    expect(res.body.data).not.toHaveProperty('api_key')
    expect((await list())[0].chatCount).toBe(2)
  })

  it('detail enforces authentication, ownership and existing super_admin policy', async () => {
    const project = await create()
    expect((await request.get(`/api/workspace/${project.id}`)).status).toBe(401)
    const other = await registerAndLogin()
    expect((await detail(project.id, other)).status).toBe(403)
    expect((await detail(999999)).status).toBe(404)
    const admin = await registerAndLoginAdmin()
    expect((await detail(project.id, admin)).status).toBe(200)
  })

  it.each(['0', '-1', '1abc', '1e0', '9007199254740992'])('rejects malformed detail id %s', async (id) => {
    await create()
    expect((await detail(id)).status).toBe(400)
  })

  it('filters active=0 and searches a title substring without leaking other users', async () => {
    const active = await create({ title: 'Alpha website project', status: 0 })
    await create({ title: 'Alpha archived', status: 2 })
    await create({ title: 'Beta', status: 0 })
    const other = await registerAndLogin()
    await create({ title: 'Alpha private', status: 0 }, other)
    expect((await list({ title: 'Alpha', status: 0 })).map((row) => row.id)).toEqual([active.id])
  })

  it('treats LIKE wildcards in a search as literal user text', async () => {
    const literal = await create({ title: '100%_! ready' })
    await create({ title: '100 percent ready' })
    expect((await list({ title: '%_!' })).map((row) => row.id)).toEqual([literal.id])
  })

  it('sorts unpaginated lists by updated_at then id, with whitelisted explicit sorting', async () => {
    const first = await create({ title: 'A' })
    const second = await create({ title: 'B' })
    const third = await create({ title: 'C' })
    await pool.query('UPDATE workspace SET updated_at = DATE_SUB(NOW(), INTERVAL 2 DAY) WHERE id = ?', [third.id])
    await pool.query('UPDATE workspace SET updated_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id IN (?, ?)', [first.id, second.id])
    expect((await list()).map((row) => row.id)).toEqual([second.id, first.id, third.id])
    expect((await list({ orderBy: 'title', orderDir: 'ASC' })).map((row) => row.title)).toEqual(['A', 'B', 'C'])
  })

  it.each([{ status: '3' }, { status: '' }, { status: 'false' }, { status: ['0', '1'] }, { orderBy: 'id; DROP TABLE workspace' }, { orderDir: 'INVALID' }])('rejects invalid list filters %#', async (query) => {
    expect((await request.get('/api/workspace/list').query(query).set(authHeader(owner.token))).status).toBe(400)
  })

  it('stats count distinct projects in a rolling 7-day window, restricted to the current user', async () => {
    const active = await create({ status: 0 })
    const paused = await create({ status: 1 })
    const archived = await create({ status: 2 })
    await pool.query("INSERT INTO chat (workspace_id, proposer, content, created_at) VALUES (?, 'user', 'recent', DATE_SUB(NOW(), INTERVAL 6 DAY)), (?, 'assistant', 'recent reply', DATE_SUB(NOW(), INTERVAL 6 DAY)), (?, 'user', 'old', DATE_SUB(NOW(), INTERVAL 8 DAY)), (?, 'user', 'future', DATE_ADD(NOW(), INTERVAL 1 DAY))", [active.id, active.id, paused.id, archived.id])
    const other = await registerAndLogin()
    const privateProject = await create({ status: 0 }, other)
    await pool.query("INSERT INTO chat (workspace_id, proposer, content) VALUES (?, 'user', 'private')", [privateProject.id])
    const res = await request.get('/api/workspace/stats').set(authHeader(owner.token))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ active: 1, paused: 1, archived: 1, advancedThisWeek: 1 })
  })
})


describe('archived project deletion', () => {
  it.each([0, 1])('rejects deleting status=%s and preserves the project', async (status) => {
    const project = await create({ status })
    const res = await request.delete('/api/workspace/' + project.id).set(authHeader(owner.token))
    expect(res.status).toBe(409)
    expect((await detail(project.id)).body.data.status).toBe(status)
  })

  it('deletes an archived project and its notes/messages without affecting another project', async () => {
    const archived = await create({ status: 2 })
    const kept = await create()
    const notes = []
    for (const project of [archived, kept]) {
      const note = await request.post('/api/note').set(authHeader(owner.token)).send({ title: 'note', content: 'saved', workspaceId: project.id })
      expect(note.status).toBe(200)
      notes.push(note.body.data?.id ?? note.body.data)
      await pool.query("INSERT INTO chat (workspace_id, proposer, content) VALUES (?, 'user', 'hello')", [project.id])
    }
    expect((await request.delete('/api/workspace/' + archived.id).set(authHeader(owner.token))).status).toBe(200)
    expect((await detail(archived.id)).status).toBe(404)
    expect((await list()).map(row => row.id)).toEqual([kept.id])
    expect((await request.get('/api/note/' + notes[0]).set(authHeader(owner.token))).status).toBe(404)
    expect((await request.get('/api/note/' + notes[1]).set(authHeader(owner.token))).status).toBe(200)
    expect((await detail(kept.id)).body.data.chatCount).toBe(1)
    expect((await request.get('/api/chat/list/' + archived.id).set(authHeader(owner.token))).status).toBe(404)
    expect((await request.delete('/api/workspace/' + archived.id).set(authHeader(owner.token))).status).toBe(404)
  })

  it('rolls back child deletions if the final project deletion fails', async () => {
    const project = await create({ status: 2 })
    const note = await request.post('/api/note').set(authHeader(owner.token)).send({ title: 'keep me', content: 'saved', workspaceId: project.id })
    expect(note.status).toBe(200)
    const noteId = note.body.data?.id ?? note.body.data
    await pool.query("INSERT INTO chat (workspace_id, proposer, content) VALUES (?, 'user', 'preserved')", [project.id])
    // Inject a database failure at the last write; observe rollback through HTTP.
    await pool.query('CREATE TABLE test_workspace_delete_guard (workspace_id INT NOT NULL, FOREIGN KEY (workspace_id) REFERENCES workspace(id))')
    try {
      await pool.query('INSERT INTO test_workspace_delete_guard VALUES (?)', [project.id])
      const res = await request.delete('/api/workspace/' + project.id).set(authHeader(owner.token))
      expect(res.status).toBe(500)
      expect((await detail(project.id)).body.data).toMatchObject({ status: 2, chatCount: 1 })
      expect((await request.get('/api/note/' + noteId).set(authHeader(owner.token))).status).toBe(200)
    } finally {
      await pool.query('DROP TABLE test_workspace_delete_guard')
    }
  })

  it('retains ownership enforcement and allows super_admin to delete archived projects', async () => {
    const archived = await create({ status: 2 })
    const other = await registerAndLogin()
    expect((await request.delete('/api/workspace/' + archived.id).set(authHeader(other.token))).status).toBe(403)
    const admin = await registerAndLoginAdmin()
    expect((await request.delete('/api/workspace/' + archived.id).set(authHeader(admin.token))).status).toBe(200)
    expect((await detail(archived.id)).status).toBe(404)
  })
})
