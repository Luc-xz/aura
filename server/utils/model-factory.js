import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

const PROVIDER_MAPPING = {
  'anthropic': createAnthropic,
  'google': createGoogleGenerativeAI,
}

export function createModelInstance(modelConfig) {
  const provider = modelConfig.provider

  if (provider === 'ollama') {
    const ollamaInstance = createOpenAI({
      baseURL: modelConfig.baseUrl,
      apiKey: 'ollama', // Ollama 不需要真实 apiKey，但 SDK 需要一个非空值
    })
    // 使用 .chat() 明确指定 Chat Completions API，而非默认的 Responses API
    return ollamaInstance.chat(modelConfig.modelName)
  }

  const creator = PROVIDER_MAPPING[provider] || createOpenAI

  const config = {
    baseURL: modelConfig.baseUrl,
  }

  if (modelConfig.apiKey) {
    config.apiKey = modelConfig.apiKey
  }

  const providerInstance = creator(config)
  return providerInstance(modelConfig.modelName)
}