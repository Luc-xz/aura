/**
 * 阶段 2 测试：Tool Calling 循环 + 工具归属安全
 *
 * 三组用例对应开发计划 2.5：
 * 1. 工具循环（HTTP + mock 模型）：模型先调 search_notes 再回答，验证 references 收集与消息落库
 * 2. 无工具路径：模型直接回答，references 必须是空数组
 * 3. 工具直测（绕过 HTTP）：搜索只返回摘要、全文截断、跨用户取不到他人笔记（信任边界）
 */
import { vi, beforeAll, describe, expect, it } from 'vitest'
import { MockLanguageModelV3, mockValues } from 'ai/test'

// vi.mock 工厂会被提升到文件顶部，跨它共享的可变状态必须用 vi.hoisted 创建
const mockState = vi.hoisted(() => ({ mode: 'search' }))

// vi.mock 会被提升到文件顶部；app.js 在 helpers.getApp() 里懒加载，
// 所以 chat.js 拿到的 createModelInstance 一定是这里的假模型。
// doGenerate 必须用 mockValues 包装才会按调用次序依次返回（裸数组语义不是序列出队）
vi.mock('../utils/model-factory.js', () => ({
  createModelInstance: () => {
    const textStop = {
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 20 },
      content: [{ type: 'text', text: '根据你的笔记《Redis 学习计划》……' }],
    }
    const searchThenText = mockValues(
      {
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 5 },
        content: [{
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'search_notes',
          input: JSON.stringify({ query: 'redis' }),   // v6 里字段名是 input，字符串化 JSON
        }],
      },
      textStop,
    )
    return new MockLanguageModelV3({ doGenerate: mockState.mode === 'search' ? searchThenText : textStop })
  },
}))

import { getRequest, registerAndLogin, authHeader } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

const createNote = async (token, note) => {
  const res = await request.post('/api/note').set(authHeader(token)).send(note)
  expect(res.status).toBe(200)
  return res.body.data
}

const setupChatWorkspace = async (user) => {
  const modelRes = await request.post('/api/model-config').set(authHeader(user.token)).send({
    provider: 'openai',
    modelName: 'gpt-4o-mini',
  })
  expect(modelRes.status).toBe(200)
  const modelId = modelRes.body.data?.id ?? modelRes.body.data

  const wsRes = await request.post('/api/workspace').set(authHeader(user.token)).send({
    title: 'tools ws',
    modelId,
  })
  expect(wsRes.status).toBe(200)
  return wsRes.body.data.id
}

describe('工具循环（HTTP + mock 模型）', () => {
  it('模型调 search_notes 后回答：references 收集命中笔记，助手消息落库', async () => {
    mockState.mode = 'search'
    const user = await registerAndLogin()
    const noteId = await createNote(user.token, {
      title: 'Redis 学习计划',
      content: 'cache-aside 模式与缓存失效策略',
      description: 'redis 相关',
    })
    const workspaceId = await setupChatWorkspace(user)

    const res = await request
      .post(`/api/chat/${workspaceId}`)
      .set(authHeader(user.token))
      .send({ content: '我之前记过 redis 相关的内容吗？', stream: false })

    expect(res.status).toBe(200)
    expect(res.body.data.content).toBe('根据你的笔记《Redis 学习计划》……')
    expect(res.body.data.references).toEqual([{ id: noteId, title: 'Redis 学习计划' }])

    const listRes = await request.get(`/api/chat/list/${workspaceId}`).set(authHeader(user.token))
    const proposers = listRes.body.data.map((row) => row.proposer)
    expect(proposers).toContain('assistant')
  })

  it('模型不调工具直接回答：references 为空数组', async () => {
    mockState.mode = 'plain'
    const user = await registerAndLogin()
    await createNote(user.token, { title: 'Redis 学习计划', content: 'cache-aside' })
    const workspaceId = await setupChatWorkspace(user)

    const res = await request
      .post(`/api/chat/${workspaceId}`)
      .set(authHeader(user.token))
      .send({ content: 'hi', stream: false })

    expect(res.status).toBe(200)
    expect(res.body.data.references).toEqual([])
  })
})

describe('工具直测（绕过 HTTP，真实入口就是被 SDK 调用的 execute）', () => {
  it('search_notes：标题与 keywords 列都能命中，且只返回摘要不含 content', async () => {
    const user = await registerAndLogin()
    const noteId = await createNote(user.token, {
      title: 'Redis 学习计划',
      content: 'cache-aside 模式',
    })
    const keywordNoteId = await createNote(user.token, {
      title: 'Docker 入门',
      content: '镜像与容器',
      keywords: ['redis', '容器'],   // 标题不含 redis，靠 JSON 列命中
    })

    const { buildNoteTools } = await import('../tool/index.js')
    const tools = buildNoteTools({ id: user.id })

    const refs = []
    const toolsWithHooks = buildNoteTools({ id: user.id }, {
      onNoteFound: (ref) => refs.push(ref),
    })
    const result = await toolsWithHooks.search_notes.execute({ query: 'redis' }, {
      toolCallId: 't1', messages: [],
    })

    expect(result.count).toBe(2)
    expect(result.notes.map((n) => n.id).sort((a, b) => a - b))
      .toEqual([noteId, keywordNoteId].sort((a, b) => a - b))
    expect(result.notes[0]).not.toHaveProperty('content')   // 纪律：不把全文喂给模型
    expect(refs.length).toBe(2)   // onNoteFound 每条命中触发一次

    // buildNoteTools 不传 hooks 也要能正常工作（hooks 是可选的）
    const bare = await tools.search_notes.execute({ query: '不存在的关键词xyz' }, {
      toolCallId: 't2', messages: [],
    })
    expect(bare.count).toBe(0)
    expect(bare.notes).toEqual([])
  })

  it('get_note_detail：本人可取全文，超长内容被截断', async () => {
    const user = await registerAndLogin()
    const noteId = await createNote(user.token, {
      title: '长文笔记',
      content: 'x'.repeat(5000),
    })

    const { buildNoteTools } = await import('../tool/index.js')
    const tools = buildNoteTools({ id: user.id })

    const result = await tools.get_note_detail.execute({ noteId }, {
      toolCallId: 't3', messages: [],
    })

    expect(result.found).toBe(true)
    expect(result.title).toBe('长文笔记')
    // 超过 MAX_CHARS(4000) 截断并加省略标记，防止全文撑爆上下文
    expect(result.content.endsWith('…（内容过长已截断）')).toBe(true)
    expect(result.content.length).toBeLessThanOrEqual(4100)
  })

  it('越权：模型拿他人的笔记 id 调 get_note_detail 只能得到 found: false', async () => {
    const alice = await registerAndLogin()
    const aliceNoteId = await createNote(alice.token, {
      title: 'Alice 的私密笔记',
      content: 'secret-content-should-not-leak',
    })
    const bob = await registerAndLogin()

    const { buildNoteTools } = await import('../tool/index.js')
    const bobTools = buildNoteTools({ id: bob.id })

    const result = await bobTools.get_note_detail.execute({ noteId: aliceNoteId }, {
      toolCallId: 't4', messages: [],
    })

    // 严格断言整个返回值：除了 found: false 不能带出任何内容
    expect(result).toEqual({ found: false })
  })
})
