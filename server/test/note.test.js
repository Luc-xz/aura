import { beforeAll, describe, expect, it } from 'vitest'
import { getRequest, registerAndLogin, registerAndLoginAdmin, authHeader } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

// Note.create 返回 insertId（数字），直接作为 id 使用
const createNote = async (token, title) => {
  const res = await request.post('/api/note').set(authHeader(token)).send({ title, content: 'hello' })
  expect(res.status).toBe(200)
  return res.body.data?.id ?? res.body.data
}

describe('GET /api/note/page', () => {
  it('未认证请求应返回 401', async () => {
    const res = await request.get('/api/note/page')
    expect(res.status).toBe(401)
  })

  it('列表只能看到自己的笔记', async () => {
    // 唯一标题，避免历史遗留行干扰断言
    const unique = `alice-private-${Date.now()}`
    const alice = await registerAndLogin()
    await createNote(alice.token, unique)
    const bob = await registerAndLogin()
    const res = await request.get('/api/note/page').set(authHeader(bob.token))
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body.data)).not.toContain(unique)
  })
})

describe('笔记横向越权防护（requireOwnership）', () => {
  it('用户不能查看他人的笔记', async () => {
    const alice = await registerAndLogin()
    const noteId = await createNote(alice.token, 'alice note 1')
    const bob = await registerAndLogin()
    const res = await request.get(`/api/note/${noteId}`).set(authHeader(bob.token))
    expect(res.status).toBe(403)
  })

  it('用户不能修改他人的笔记', async () => {
    const alice = await registerAndLogin()
    const noteId = await createNote(alice.token, 'alice note 2')
    const bob = await registerAndLogin()
    const res = await request.put(`/api/note/${noteId}`).set(authHeader(bob.token)).send({ title: 'hacked' })
    expect(res.status).toBe(403)
  })

  it('用户不能删除他人的笔记', async () => {
    const alice = await registerAndLogin()
    const noteId = await createNote(alice.token, 'alice note 3')
    const bob = await registerAndLogin()
    const res = await request.delete(`/api/note/${noteId}`).set(authHeader(bob.token))
    expect(res.status).toBe(403)
  })

  it('super_admin 可以管理任何笔记', async () => {
    const alice = await registerAndLogin()
    const noteId = await createNote(alice.token, 'alice note 4')
    const root = await registerAndLoginAdmin()
    const res = await request.put(`/api/note/${noteId}`).set(authHeader(root.token)).send({ title: 'admin edited' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
  })

  it('操作不存在的笔记应返回 404', async () => {
    const alice = await registerAndLogin()
    const res = await request.put('/api/note/999999').set(authHeader(alice.token)).send({ title: 'x' })
    expect(res.status).toBe(404)
  })
})

describe('note 来源关联与归属校验', () => {
  const createWorkspace = async (token, title = 'ws') => {
    const res = await request.post('/api/workspace').set(authHeader(token)).send({ title })
    expect(res.status).toBe(200)
    return res.body.data.id
  }

  const createChat = async (workspaceId, content = 'source message') => {
    const Chat = (await import('../models/chat.js')).default
    return Chat.create({ workspaceId, proposer: 'assistant', content })
  }

  it('保存时携带 workspaceId / sourceChatId，回显正确', async () => {
    const user = await registerAndLogin()
    const workspaceId = await createWorkspace(user.token)
    const sourceChatId = await createChat(workspaceId)

    const res = await request.post('/api/note').set(authHeader(user.token)).send({
      title: '来源笔记',
      content: '沉淀内容',
      workspaceId,
      sourceChatId,
    })
    expect(res.status).toBe(200)
    const noteId = res.body.data?.id ?? res.body.data

    const page = await request.get('/api/note/page').set(authHeader(user.token))
    expect(page.status).toBe(200)
    const found = page.body.data.rows.find((n) => n.id === noteId)
    expect(found).toBeTruthy()
    expect(found.workspaceId).toBe(workspaceId)
    expect(found.sourceChatId).toBe(sourceChatId)
  })

  it('传他人的 workspaceId 被拒绝', async () => {
    const alice = await registerAndLogin()
    const aliceWs = await createWorkspace(alice.token, 'alice ws')
    const bob = await registerAndLogin()

    const res = await request.post('/api/note').set(authHeader(bob.token)).send({
      title: '越权笔记',
      content: 'should not save',
      workspaceId: aliceWs,
    })
    expect(res.status).toBe(400)

    const page = await request.get('/api/note/page').set(authHeader(bob.token))
    const titles = (page.body.data.rows || []).map((n) => n.title)
    expect(titles).not.toContain('越权笔记')
  })

  it('传他人的 sourceChatId 被拒绝', async () => {
    const alice = await registerAndLogin()
    const aliceWs = await createWorkspace(alice.token, 'alice chat ws')
    const aliceChatId = await createChat(aliceWs)
    const bob = await registerAndLogin()

    const res = await request.post('/api/note').set(authHeader(bob.token)).send({
      title: '越权来源',
      content: 'should not save',
      sourceChatId: aliceChatId,
    })
    expect(res.status).toBe(400)
  })

  it('按 workspaceId 过滤笔记列表', async () => {
    const user = await registerAndLogin()
    const workspaceId = await createWorkspace(user.token, 'filter ws')

    const linked = await request.post('/api/note').set(authHeader(user.token)).send({
      title: '项目内笔记',
      content: 'in',
      workspaceId,
    })
    expect(linked.status).toBe(200)
    const unlinked = await request.post('/api/note').set(authHeader(user.token)).send({
      title: '无项目笔记',
      content: 'out',
    })
    expect(unlinked.status).toBe(200)

    const res = await request.get('/api/note/page').query({ workspaceId }).set(authHeader(user.token))
    expect(res.status).toBe(200)
    const titles = res.body.data.rows.map((n) => n.title)
    expect(titles).toContain('项目内笔记')
    expect(titles).not.toContain('无项目笔记')
  })
})
