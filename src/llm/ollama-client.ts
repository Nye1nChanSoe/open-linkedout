import { LLMError } from "@/app/errors/llm-error.js";
import llmConfig from "@/config/llm.config.js";
import ollamaConfig from "@/config/ollama.config.js";
import type { OllamaClientContract } from "@/contracts/ollama-client.contract.js";
import type {
  OllamaChatNativeApiResponseType,
  OllamaChatInputType,
  LLMChatResponseType,
} from "@/types/ollama.type.js";
import { numberOrUndefined, stringOrUndefined } from "@/utils/utils.js";

export class OllamaClient implements OllamaClientContract {
  constructor(private readonly baseUrl = ollamaConfig.BASE_URL) {}

  async chat(input: OllamaChatInputType): Promise<LLMChatResponseType> {
    let response: Response;

    try {
      response = await fetch(
        new URL(ollamaConfig.ENDPOINTS.CHAT, this.baseUrl),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...input,
            stream: llmConfig.INFERENCE.IS_STREAMING,
          }),
        },
      );
    } catch (error) {
      throw new LLMError(
        "Could not connect to the local Ollama server.",
        "LLM_UNAVAILABLE",
        true,
        error,
      );
    }

    if (!response.ok) {
      throw new LLMError(
        `Ollama chat request failed with HTTP ${response.status}.`,
        "LLM_UNAVAILABLE",
        response.status === 429 || response.status >= 500,
      );
    }

    // ollama's api response:
    // we need to map it back to `LLMChatResponseType`
    // for our application
    let responseBody: OllamaChatNativeApiResponseType;

    try {
      responseBody = (await response.json()) as OllamaChatNativeApiResponseType;
    } catch (error) {
      throw new LLMError(
        "Ollama returned an invalid chat response.",
        "LLM_INVALID_RESPONSE",
        false,
        error,
      );
    }

    if (
      typeof responseBody.model !== "string" ||
      typeof responseBody.message?.content !== "string"
    ) {
      throw new LLMError(
        "Ollama returned a chat response without model content.",
        "LLM_INVALID_RESPONSE",
        false,
      );
    }

    return {
      model: responseBody.model,
      content: responseBody.message.content,

      // for debugging purposes
      promptEvalCount: numberOrUndefined(responseBody.prompt_eval_count),
      evalCount: numberOrUndefined(responseBody.eval_count),
      doneReason: stringOrUndefined(responseBody.done_reason),
    };
  }
}
