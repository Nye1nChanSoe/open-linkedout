import type {
  OllamaChatInputType,
  LLMChatResponseType,
} from "@/types/ollama.type.js";

export interface OllamaClientContract {
  /**
   * Sends one `chat` request to Ollama.
   * @param input - Model, messages, and optional structured-output settings.
   * @returns Completed chat response.
   */
  chat(input: OllamaChatInputType): Promise<LLMChatResponseType>;
}
