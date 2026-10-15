import pool from '../sql/index.js'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getRequest, registerAndLogin, registerAndLoginAdmin, authHeader, cleanTable } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

// 创建一个属于指定用户的模型配置，返回其 id
const createModelConfig = async (token) => {
  const res = await request
    .post('/api/model-config')
    .set(authHeader(token))
    .send({ provider: 'openai', modelName: 'gpt-test' })
  expect(res.status).toBe(200)
  return res.body.data?.id ?? res.body.data
}

beforeEach(async () => {
  await cleanTable('workspace')
  await cleanTable('user_role')
  await cleanTable('user')
})

describe('GET /api/workspace/list', () => {
  it('未认证请求应返回 401', async () => {
    const res = await request.get('/api/workspace/list')
    expect(res.status).toBe(401)
  })

  it('认证请求应返回空列表', async () => {
    const { token } = await registerAndLogin()
    const res = await request.get('/api/workspace/list').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
  })
})

describe('POST /api/workspace/', () => {
  it('未认证请求应返回 401', async () => {
    const res = await request.post('/api/workspace').send({ title: 'test' })
    expect(res.status).toBe(401)
  })

  it('应成功创建工作区', async () => {
    const { token } = await registerAndLogin()
    const modelId = await createModelConfig(token)
    const res = await request
      .post('/api/workspace')
      .set(authHeader(token))
      .send({ title: 'test workspace', modelId })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
    expect(res.body.data).toBeInstanceOf(Object)
    expect(res.body.data.id).toBeDefined()
  })

  it('创建后应在列表中查到', async () => {
    const { token } = await registerAndLogin()
    const createRes = await request
      .post('/api/workspace')
      .set(authHeader(token))
      .send({ title: 'my workspace' })

    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    const found = listRes.body.data.find(w => w.id === createRes.body.data.id)
    expect(found).toBeDefined()
    expect(found.title).toBe('my workspace')
  })
})

describe('PUT /api/workspace/:id', () => {
  let token, workspaceId

  beforeEach(async () => {
    const auth = await registerAndLogin()
    token = auth.token
    const res = await request
      .post('/api/workspace')
      .set(authHeader(token))
      .send({ title: 'original title' })
    workspaceId = res.body.data.id
  })

  it('编辑后 title 应更新', async () => {
    const updateRes = await request
      .put(`/api/workspace/${workspaceId}`)
      .set(authHeader(token))
      .send({ title: 'updated title' })

    expect(updateRes.body.code).toBe(200)

    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    const found = listRes.body.data.find(w => w.id === workspaceId)
    expect(found.title).toBe('updated title')
  })

  it('编辑后 modelId 应更新', async () => {
    const modelId = await createModelConfig(token)

    const updateRes = await request
      .put(`/api/workspace/${workspaceId}`)
      .set(authHeader(token))
      .send({ modelId })

    expect(updateRes.body.code).toBe(200)

    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    const found = listRes.body.data.find(w => w.id === workspaceId)
    expect(found.modelId).toBe(modelId)
  })

  it('不能挂载他人的模型配置', async () => {
    const alice = await registerAndLogin()
    const aliceModelId = await createModelConfig(alice.token)

    const res = await request
      .put(`/api/workspace/${workspaceId}`)
      .set(authHeader(token))
      .send({ modelId: aliceModelId })
    expect(res.status).toBe(403)
  })

  it('挂载不存在的模型配置应返回 404', async () => {
    const res = await request
      .put(`/api/workspace/${workspaceId}`)
      .set(authHeader(token))
      .send({ modelId: 999999 })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/workspace/:id', () => {
  let token, workspaceId

  beforeEach(async () => {
    const auth = await registerAndLogin()
    token = auth.token
    const res = await request
      .post('/api/workspace')
      .set(authHeader(token))
      .send({ title: 'to be deleted', status: 2 })
    workspaceId = res.body.data.id
  })

  it('应成功删除工作区', async () => {
    const deleteRes = await request
      .delete(`/api/workspace/${workspaceId}`)
      .set(authHeader(token))

    expect(deleteRes.body.code).toBe(200)
    expect(deleteRes.body.data).toBe(true)
  })

  it('删除后不应在列表中', async () => {
    await request.delete(`/api/workspace/${workspaceId}`).set(authHeader(token))

    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    const found = listRes.body.data.find(w => w.id === workspaceId)
    expect(found).toBeUndefined()
  })
})

describe('横向越权防护（requireOwnership）', () => {
  it('用户不能修改他人的工作区', async () => {
    const alice = await registerAndLogin()
    const createRes = await request
      .post('/api/workspace')
      .set(authHeader(alice.token))
      .send({ title: 'alice workspace' })
    const workspaceId = createRes.body.data.id

    const bob = await registerAndLogin()
    const res = await request
      .put(`/api/workspace/${workspaceId}`)
      .set(authHeader(bob.token))
      .send({ title: 'hacked title' })

    expect(res.status).toBe(403)
  })

  it('用户不能删除他人的工作区', async () => {
    const alice = await registerAndLogin()
    const createRes = await request
      .post('/api/workspace')
      .set(authHeader(alice.token))
      .send({ title: 'alice workspace 2' })
    const workspaceId = createRes.body.data.id

    const bob = await registerAndLogin()
    const res = await request
      .delete(`/api/workspace/${workspaceId}`)
      .set(authHeader(bob.token))

    expect(res.status).toBe(403)
  })

  it('super_admin 可以管理任何工作区', async () => {
    const alice = await registerAndLogin()
    const createRes = await request
      .post('/api/workspace')
      .set(authHeader(alice.token))
      .send({ title: 'alice workspace 3' })
    const workspaceId = createRes.body.data.id

    const admin = await registerAndLoginAdmin()
    const res = await request
      .put(`/api/workspace/${workspaceId}`)
      .set(authHeader(admin.token))
      .send({ title: 'admin edited' })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
  })

  it('操作不存在的工作区应返回 404', async () => {
    const { token } = await registerAndLogin()
    const res = await request
      .put('/api/workspace/999999')
      .set(authHeader(token))
      .send({ title: 'not found' })

    expect(res.status).toBe(404)
  })
})

describe('项目化字段（goal / description / status）', () => {
  let token

  beforeEach(async () => {
    await cleanTable('workspace')
    await cleanTable('user_role')
    await cleanTable('user')
    const auth = await registerAndLogin()
    token = auth.token
  })

  const createWs = (payload) =>
    request.post('/api/workspace').set(authHeader(token)).send(payload)

  it('创建时可带目标/背景/状态', async () => {
    const res = await createWs({
      title: '品牌官网改版',
      goal: '三个月内完成官网信息架构与视觉改版',
      description: '重构首页叙事，统一组件库。',
      status: 0,
    })
    expect(res.status).toBe(200)
    expect(res.body.data.goal).toBe('三个月内完成官网信息架构与视觉改版')
    expect(res.body.data.description).toBe('重构首页叙事，统一组件库。')
    expect(res.body.data.status).toBe(0)
  })

  it('status 缺省时为 0（进行中）', async () => {
    const res = await createWs({ title: 'no status' })
    expect(res.body.data.status).toBe(0)
  })

  it('status=3 应返回 400', async () => {
    const res = await createWs({ title: 'bad status', status: 3 })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('status')
  })

  it('goal 超过 255 字应返回 400', async () => {
    const res = await createWs({ title: 'long goal', goal: 'x'.repeat(256) })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('goal')
  })

  it('description 超过 2000 字应返回 400', async () => {
    const res = await createWs({ title: 'long desc', description: 'x'.repeat(2001) })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('description')
  })

  it('列表返回应包含 goal/description/status 键', async () => {
    await createWs({ title: 'fields ws' })
    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    const row = listRes.body.data[0]
    expect(row).toHaveProperty('goal')
    expect(row).toHaveProperty('description')
    expect(row).toHaveProperty('status')
  })

  it('PUT 单独改 status 为 2（归档）后列表可见', async () => {
    const created = await createWs({ title: 'to archive' })
    const updateRes = await request
      .put(`/api/workspace/${created.body.data.id}`)
      .set(authHeader(token))
      .send({ status: 2 })
    expect(updateRes.body.code).toBe(200)

    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    expect(listRes.body.data[0].status).toBe(2)
  })

  it('PUT goal 传空串应清空为 null', async () => {
    const created = await createWs({ title: 'clear goal', goal: '旧目标' })
    await request
      .put(`/api/workspace/${created.body.data.id}`)
      .set(authHeader(token))
      .send({ goal: '' })

    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    expect(listRes.body.data[0].goal).toBeNull()
  })

  it('PUT 全部字段缺省应返回 400', async () => {
    const created = await createWs({ title: 'no field' })
    const res = await request
      .put(`/api/workspace/${created.body.data.id}`)
      .set(authHeader(token))
      .send({})
    expect(res.status).toBe(400)
  })

  it('列表支持按 status 过滤', async () => {
    await createWs({ title: 'a', status: 0 })
    await createWs({ title: 'b', status: 2 })
    const listRes = await request
      .get('/api/workspace/list?status=2')
      .set(authHeader(token))
    expect(listRes.body.data).toHaveLength(1)
    expect(listRes.body.data[0].title).toBe('b')
  })
})

describe('GET /api/workspace/stats', () => {
  beforeEach(async () => {
    await cleanTable('workspace')
    await cleanTable('chat')
    await cleanTable('user_role')
    await cleanTable('user')
  })

  it('未认证请求应返回 401', async () => {
    const res = await request.get('/api/workspace/stats')
    expect(res.status).toBe(401)
  })

  it('应按状态计数，并统计近 7 天有对话的项目数', async () => {
    const { token } = await registerAndLogin()
    const mk = async (title, status) =>
      (await request.post('/api/workspace').set(authHeader(token)).send({ title, status })).body.data.id
    const advanced = await mk('进行中A', 0)
    await mk('进行中B', 0)
    await mk('暂停', 1)
    await mk('归档', 2)
    // 直接插一条 7 天内的对话（绕过真实模型调用），只让 advanced 项目"本周有推进"
    await pool.execute('INSERT INTO chat (workspace_id, proposer, content) VALUES (?, ?, ?)', [advanced, 'user', 'hi'])

    const res = await request.get('/api/workspace/stats').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ active: 2, paused: 1, archived: 1, advancedThisWeek: 1 })
  })

  it('无任何项目时四项均为 0', async () => {
    const { token } = await registerAndLogin()
    const res = await request.get('/api/workspace/stats').set(authHeader(token))
    expect(res.body.data).toEqual({ active: 0, paused: 0, archived: 0, advancedThisWeek: 0 })
  })
})
