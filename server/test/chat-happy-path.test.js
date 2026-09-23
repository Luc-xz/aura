import pool from '../sql/index.js'
/**
 * 对话 happy-path 冒烟测试
 * 用 MockLanguageModelV3 替换真实模型，验证「发消息 → 模型回复 → 双方消息落库」主链路。
 * 任何 chat.js 主流程的回归（如 ReferenceError、消息构造错误）都应先在这里变红。
 */
import { vi, beforeAll, describe, expect, it } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'

// vi.mock 会被提升到文件顶部；app.js 在 helpers.getApp() 里懒加载，
// 所以 chat.js 拿到的 createModelInstance 一定是这里的假模型
vi.mock('../utils/model-factory.js', () => ({
  createModelInstance: () =>
    new MockLanguageModelV3({
      doGenerate: {
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 10 },
        content: [{ type: 'text', text: 'mocked reply' }],
      },
    }),
}))

import { getRequest, registerAndLogin, authHeader } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

// 创建属于该用户的模型配置，返回其 id
const createModelConfig = async (token) => {
  const res = await request.post('/api/model-config').set(authHeader(token)).send({
    provider: 'openai',
    modelName: 'gpt-4o-mini',
  })
  expect(res.status).toBe(200)
  return res.body.data?.id ?? res.body.data
}

describe('对话 happy path', () => {
  it('发消息后返回模型回复，用户/助手消息均落库', async () => {
    const user = await registerAndLogin()

    const modelRes = await request.post('/api/model-config').set(authHeader(user.token)).send({
      provider: 'openai',
      modelName: 'gpt-4o-mini',
    })
    expect(modelRes.status).toBe(200)
    const modelId = modelRes.body.data?.id ?? modelRes.body.data

    // 创建时直接挂载模型（挂载校验要求配置属于创建者）
    const wsRes = await request.post('/api/workspace').set(authHeader(user.token)).send({
      title: 'happy path ws',
      modelId,
    })
    expect(wsRes.status).toBe(200)
    const workspaceId = wsRes.body.data.id

    const chatRes = await request
      .post(`/api/chat/${workspaceId}`)
      .set(authHeader(user.token))
      .send({ content: 'hi', stream: false })

    expect(chatRes.status).toBe(200)
    // 阶段 2 起响应升级为 { content, references }
    expect(chatRes.body.data.content).toBe('mocked reply')
    expect(chatRes.body.data.references).toEqual([])

    const listRes = await request
      .get(`/api/chat/list/${workspaceId}`)
      .set(authHeader(user.token))
    expect(listRes.status).toBe(200)

    // list 端点不传分页参数，data 直接是消息数组
    const messages = listRes.body.data
    const proposers = messages.map((row) => row.proposer)
    expect(proposers).toContain('user')
    expect(proposers).toContain('assistant')

    // 用户消息落库时应带上本次使用的模型配置 id
    const userRow = messages.find((row) => row.proposer === 'user')
    expect(userRow.modelId).toBe(modelId)
  })

  it('新建项目未指定模型时回退用户默认模型（创建时落地）', async () => {
    const user = await registerAndLogin()
    const modelId = await createModelConfig(user.token)

    const settingsRes = await request
      .put('/api/user/settings')
      .set(authHeader(user.token))
      .send({ defaultModelId: modelId })
    expect(settingsRes.status).toBe(200)
    expect(settingsRes.body.code).toBe(200)

    // 不传 modelId：POST /api/workspace 应把默认模型落到工作区上
    const wsRes = await request
      .post('/api/workspace')
      .set(authHeader(user.token))
      .send({ title: 'fallback ws' })
    expect(wsRes.status).toBe(200)
    expect(wsRes.body.data.modelId).toBe(modelId)
  })

  it('存量项目未挂模型时，聊天按 use_default_model 回退默认模型', async () => {
    const user = await registerAndLogin()

    // 先在工作区无模型、也无默认模型时创建（modelId 为 NULL 的存量形态）
    const wsRes = await request
      .post('/api/workspace')
      .set(authHeader(user.token))
      .send({ title: 'legacy ws' })
    expect(wsRes.status).toBe(200)
    const workspaceId = wsRes.body.data.id
    expect(wsRes.body.data.modelId).toBeNull()

    // 用户随后设置默认模型，存量项目应能直接对话
    const modelId = await createModelConfig(user.token)
    const settingsRes = await request.put('/api/user/settings').set(authHeader(user.token)).send({ defaultModelId: modelId })
    expect(settingsRes.status).toBe(200)

    const chatRes = await request
      .post(`/api/chat/${workspaceId}`)
      .set(authHeader(user.token))
      .send({ content: 'hi', stream: false })
    expect(chatRes.status).toBe(200)
    expect(chatRes.body.data.content).toBe('mocked reply')
  })
})


describe('project activity from chat', () => {
  it('moves a previously old project to the top after persisted chat and counts both messages', async () => {
    const user = await registerAndLogin()
    const modelId = await createModelConfig(user.token)
    const projectIds = []
    for (const title of ['old project', 'newer project']) {
      const res = await request.post('/api/workspace').set(authHeader(user.token)).send({ title, modelId })
      expect(res.status).toBe(200)
      projectIds.push(res.body.data.id)
    }
    await pool.query('UPDATE workspace SET updated_at = NOW() - INTERVAL 10 DAY WHERE id = ?', [projectIds[0]])
    await pool.query('UPDATE workspace SET updated_at = NOW() - INTERVAL 2 DAY WHERE id = ?', [projectIds[1]])
    const before = await request.get('/api/workspace/list').set(authHeader(user.token))
    expect(before.body.data.map(row => row.id)).toEqual([projectIds[1], projectIds[0]])
    const response = await request.post('/api/chat/' + projectIds[0]).set(authHeader(user.token)).send({ content: 'advance this project', stream: false })
    expect(response.status).toBe(200)
    const after = await request.get('/api/workspace/list').set(authHeader(user.token))
    expect(after.status).toBe(200)
    expect(after.body.data.map(row => row.id)).toEqual([projectIds[0], projectIds[1]])
    expect(after.body.data[0].chatCount).toBe(2)
    expect(after.body.data[0].updatedAt).not.toBe(before.body.data[1].updatedAt)
    const stats = await request.get('/api/workspace/stats').set(authHeader(user.token))
    expect(stats.body.data.advancedThisWeek).toBe(1)
  })
})
