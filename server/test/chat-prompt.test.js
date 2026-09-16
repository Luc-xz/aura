import { vi, beforeAll, describe, expect, it } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'

// 捕获每次调用时喂给模型的消息列表（v6 里字段名是 prompt）
const captured = vi.hoisted(() => ({ prompts: [] }))

vi.mock('../utils/model-factory.js', () => ({
  createModelInstance: () =>
    new MockLanguageModelV3({
      doGenerate: async (options) => {
        captured.prompts.push(options.prompt)
        return {
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 10 },
          content: [{ type: 'text', text: 'mocked reply' }],
        }
      },
    }),
}))

import { getRequest, registerAndLogin, authHeader } from './helpers.js'

let request
beforeAll(async () => { request = await getRequest() })

const setupChatWorkspace = async (user) => {
  const modelRes = await request.post('/api/model-config').set(authHeader(user.token)).send({
    provider: 'openai',
    modelName: 'gpt-4o-mini',
  })
  expect(modelRes.status).toBe(200)
  const modelId = modelRes.body.data?.id ?? modelRes.body.data

  const wsRes = await request.post('/api/workspace').set(authHeader(user.token)).send({
    title: 'prompt ws',
    modelId,
  })
  expect(wsRes.status).toBe(200)
  return wsRes.body.data.id
}

describe('喂给模型的消息组装', () => {
  it('当前消息只出现一次，且整体时间正序', async () => {
    const user = await registerAndLogin()
    const workspaceId = await setupChatWorkspace(user)

    for (const content of ['first-question', 'second-question']) {
      const res = await request
        .post(`/api/chat/${workspaceId}`)
        .set(authHeader(user.token))
        .send({ content, stream: false })
      expect(res.status).toBe(200)
    }

    const prompt = captured.prompts.at(-1)          // 最后一次调用 = 第二轮
    // prompt 里 system 的 content 是字符串，user/assistant 是 [{type:'text', text}] 数组，
    // 统一抽成纯文本再断言
    const textOf = (m) =>
      typeof m.content === 'string' ? m.content : m.content.map((p) => p.text).join('')
    const contents = prompt.map(textOf)

    // 当前消息不重复（旧 bug：rows 里一份 + 手动 append 一份）
    expect(contents.filter((c) => c === 'second-question').length).toBe(1)
    // 时间正序（旧 bug：desc 直接喂，最新在前）
    expect(contents.indexOf('first-question')).toBeLessThan(contents.indexOf('second-question'))
  })
})