import { beforeAll, beforeEach, describe, it, expect } from 'vitest'
import { getRequest, registerAndLogin, authHeader, cleanTable } from './helpers.js'

let request, user
beforeAll(async () => { request = await getRequest() })
beforeEach(async () => {
  for (const table of ['user_settings', 'model_config', 'user_role', 'user']) await cleanTable(table)
  user = await registerAndLogin()
})

const createModel = async (token, modelName = 'default-model') => {
  const res = await request.post('/api/model-config').set(authHeader(token)).send({ provider: 'openai', modelName })
  expect(res.status).toBe(200)
  return res.body.data?.id ?? res.body.data
}
const getSettings = (token) => request.get('/api/user/settings').set(authHeader(token))
const putSettings = (token, payload) => request.put('/api/user/settings').set(authHeader(token)).send(payload)

describe('user settings', () => {
  it('returns defaults for a user without stored settings', async () => {
    const res = await getSettings(user.token)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ defaultModelId: null, systemPrompt: null, autoSaveInterval: 0, language: 'zh-CN' })
  })

  it('stores defaultModelId, keeps other fields on partial updates, and clears it with null', async () => {
    const modelId = await createModel(user.token)
    const put = await putSettings(user.token, { defaultModelId: modelId })
    expect(put.status).toBe(200)
    expect(put.body.data.defaultModelId).toBe(modelId)

    // 只更新 autoSaveInterval，其余字段保持
    const partial = await putSettings(user.token, { autoSaveInterval: 30 })
    expect(partial.status).toBe(200)
    expect(partial.body.data).toMatchObject({ defaultModelId: modelId, autoSaveInterval: 30, language: 'zh-CN' })

    const cleared = await putSettings(user.token, { defaultModelId: null })
    expect(cleared.status).toBe(200)
    expect((await getSettings(user.token)).body.data.defaultModelId).toBeNull()
  })

  it('passes systemPrompt and language through without business logic', async () => {
    const put = await putSettings(user.token, { systemPrompt: '回答保持简洁', language: 'en-US' })
    expect(put.status).toBe(200)
    expect(put.body.data).toMatchObject({ systemPrompt: '回答保持简洁', language: 'en-US' })
    expect((await getSettings(user.token)).body.data).toMatchObject({ systemPrompt: '回答保持简洁', language: 'en-US' })
  })

  it('rejects invalid payloads', async () => {
    for (const payload of [
      {},
      { defaultModelId: -1 },
      { defaultModelId: 'abc' },
      { systemPrompt: 42 },
      { autoSaveInterval: -1 },
      { autoSaveInterval: 1.5 },
      { language: 'x'.repeat(21) },
    ]) {
      expect((await putSettings(user.token, payload)).status).toBe(400)
    }
  })

  it('rejects a missing or foreign defaultModelId', async () => {
    expect((await putSettings(user.token, { defaultModelId: 999999 })).status).toBe(404)
    const other = await registerAndLogin()
    const otherModel = await createModel(other.token, 'other-model')
    expect((await putSettings(user.token, { defaultModelId: otherModel })).status).toBe(403)
  })

  it('requires authentication and keeps settings per-user', async () => {
    expect((await request.get('/api/user/settings')).status).toBe(401)
    expect((await request.put('/api/user/settings').send({ language: 'en-US' })).status).toBe(401)
    const other = await registerAndLogin()
    const modelId = await createModel(user.token)
    expect((await putSettings(user.token, { defaultModelId: modelId })).status).toBe(200)
    expect((await getSettings(other.token)).body.data.defaultModelId).toBeNull()
  })
})
