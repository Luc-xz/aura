import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getRequest, registerAndLogin, authHeader, cleanTable } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

beforeEach(async () => {
  await cleanTable('workspace')
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
    expect(res.body.code).toBe(1)
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
    const res = await request
      .post('/api/workspace')
      .set(authHeader(token))
      .send({ title: 'test workspace', modelId: 123456 })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(1)
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

    expect(updateRes.body.code).toBe(1)

    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    const found = listRes.body.data.find(w => w.id === workspaceId)
    expect(found.title).toBe('updated title')
  })

  it('编辑后 modelId 应更新', async () => {
    await request
      .put(`/api/workspace/${workspaceId}`)
      .set(authHeader(token))
      .send({ modelId: 999 })

    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    const found = listRes.body.data.find(w => w.id === workspaceId)
    expect(found.modelId).toBe(999)
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
      .send({ title: 'to be deleted' })
    workspaceId = res.body.data.id
  })

  it('应成功删除工作区', async () => {
    const deleteRes = await request
      .delete(`/api/workspace/${workspaceId}`)
      .set(authHeader(token))

    expect(deleteRes.body.code).toBe(1)
    expect(deleteRes.body.data).toBe(true)
  })

  it('删除后不应在列表中', async () => {
    await request.delete(`/api/workspace/${workspaceId}`).set(authHeader(token))

    const listRes = await request.get('/api/workspace/list').set(authHeader(token))
    const found = listRes.body.data.find(w => w.id === workspaceId)
    expect(found).toBeUndefined()
  })
})