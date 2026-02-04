import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

const PROVIDER_MAPPING = {
  'anthropic': createAnthropic,
  'google': createGoogleGenerativeAI,
}

export function createModelInstance(modelConfig) {
  const creator = PROVIDER_MAPPING[modelConfig.providerType] || createOpenAI

  const providerInstance = creator({
    baseURL: modelConfig.baseUrl,
    apiKey: modelConfig.apiKey,
  })

  return providerInstance(modelConfig.modelName)
}