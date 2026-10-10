/**
 * 上游模型调用失败的收尾行为：
 *
 * - 流式：AI SDK 把上游错误转成 fullStream 的 error part 而不是 throw，
 *   端点必须消费该 part 并发 SSE error 事件（直透上游 message，空信息才兜底）、
 *   不发 done、不落空 assistant 消息
 * - 非流式：generateText 直接 throw，端点转 502 + 同样直透、不落 assistant 消息
 */
import { vi, beforeAll, describe, expect, it } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'
import { APICallError } from 'ai'

const mockState = vi.hoisted(() => ({ mode: 'invalid-key' }))

const upstreamError = () => {
  if (mockState.mode === 'invalid-key') {
    // 复刻阶跃 401：不可重试的鉴权错误，message 为上游原文
    return new APICallError({
      message: 'Incorrect API key provided',
      url: 'https://api.stepfun.com/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 401,
      responseHeaders: {},
      responseBody: '',
      isRetryable: false,
    })
  }
  if (mockState.mode === 'empty') {
    return new Error('')
  }
  return new Error('boom')
}

vi.mock('../utils/model-factory.js', () => ({
  createModelInstance: () => new MockLanguageModelV3({
    doStream: async () => { throw upstreamError() },
    doGenerate: async () => { throw upstreamError() },
  }),
}))

import { getRequest, registerAndLogin, authHeader } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

const setupWorkspace = async (user) => {
  const modelRes = await request.post('/api/model-config').set(authHeader(user.token)).send({
    provider: 'openai',
    modelName: 'step-5-preview',
  })
  expect(modelRes.status).toBe(200)
  const modelId = modelRes.body.data?.id ?? modelRes.body.data
  const wsRes = await request.post('/api/workspace').set(authHeader(user.token)).send({
    title: 'upstream error ws',
    modelId,
  })
  expect(wsRes.status).toBe(200)
  return wsRes.body.data.id
}

const assistantRows = async (token, workspaceId) => {
  const res = await request.get(`/api/chat/list/${workspaceId}`).set(authHeader(token))
  return res.body.data.filter((row) => row.proposer === 'assistant')
}

const parseSseEvents = (text) =>
  text.split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')))

describe('上游 401（流式）', () => {
  it('SSE 以 error 事件收尾：直透上游 message，不发 done，不落空 assistant 行', async () => {
    const user = await registerAndLogin()
    const workspaceId = await setupWorkspace(user)

    const res = await request
      .post(`/api/chat/${workspaceId}`)
      .set(authHeader(user.token))
      .send({ content: 'hi', stream: true })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')

    const events = parseSseEvents(res.text)
    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent.statusCode).toBe(401)
    expect(errorEvent.message).toBe('Incorrect API key provided')
    // error 之后绝不能再发 done，否则前端会把「已中断」误置回 idle
    expect(events.find((e) => e.type === 'done')).toBeUndefined()

    // 用户消息已提前落库，但失败回合不得产生空 assistant 消息
    const rows = await assistantRows(user.token, workspaceId)
    expect(rows).toEqual([])
  })
})

describe('上游 401（非流式）', () => {
  it('返回 502 + 直透上游 message，不落 assistant 行', async () => {
    const user = await registerAndLogin()
    const workspaceId = await setupWorkspace(user)

    const res = await request
      .post(`/api/chat/${workspaceId}`)
      .set(authHeader(user.token))
      .send({ content: 'hi', stream: false })

    expect(res.status).toBe(502)
    expect(res.body.message).toBe('Incorrect API key provided')
    const rows = await assistantRows(user.token, workspaceId)
    expect(rows).toEqual([])
  })
})

describe('上游错误信息为空时兜底', () => {
  it('流式：error 事件带兜底文案，仍正常收尾', async () => {
    mockState.mode = 'empty'
    const user = await registerAndLogin()
    const workspaceId = await setupWorkspace(user)

    const res = await request
      .post(`/api/chat/${workspaceId}`)
      .set(authHeader(user.token))
      .send({ content: 'hi', stream: true })

    expect(res.status).toBe(200)
    const events = parseSseEvents(res.text)
    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent.statusCode).toBeNull()
    expect(errorEvent.message).toBe('上游模型调用失败')
    expect(events.find((e) => e.type === 'done')).toBeUndefined()
    mockState.mode = 'invalid-key'
  })
})
