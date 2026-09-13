import { vi, beforeAll, describe, expect, it } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'

vi.mock('../utils/model-factory.js', () => {
  return {
    createModelInstance: () =>
      new MockLanguageModelV3({
        doGenerate: [
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
          {
            finishReason: 'stop',
            usage: { inputTokens: 50, outputTokens: 20 },
            content: [{ type: 'text', text: '根据你的笔记《Redis 学习计划》……' }],
          },
        ],
      }),
  }
})

import { getRequest, registerAndLogin, authHeader } from './helpers.js'