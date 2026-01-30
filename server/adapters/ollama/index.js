import BaseLLMProvider from "../base.js";
import OpenAI from "openai";
export default class OllamaLLMProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
    });
  }

  async chat(messages) {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
    });
    return response;
  }
}