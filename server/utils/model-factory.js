import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

const PROVIDER_MAPPING = {
  'anthropic': createAnthropic,
  'google': createGoogleGenerativeAI,
}

export function createModelInstance(modelConfig) {
  const provider = modelConfig.provider

  if (!PROVIDER_MAPPING[provider]) {
    const openAICompatibleInstance = createOpenAI({
      baseURL: modelConfig.baseUrl,
      apiKey: modelConfig.apiKey || 'openai-compatible',
    })
    // Most third-party OpenAI-compatible gateways only expose /chat/completions.
    return openAICompatibleInstance.chat(modelConfig.modelName)
  }

  const creator = PROVIDER_MAPPING[provider]
  const config = {
    baseURL: modelConfig.baseUrl,
  }

  if (modelConfig.apiKey) {
    config.apiKey = modelConfig.apiKey
  }

  const providerInstance = creator(config)
  return providerInstance(modelConfig.modelName)
}