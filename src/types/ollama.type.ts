// OllamaChatInputType

/** POST /api/chat
{
  "model": "qwen3:4b",
  "messages": [
    { "role": "system", "content": "<resume inference system prompt>" },
    { "role": "user", "content": "<normalized resume text>" }
  ],
  "format": "<resume inference JSON schema>",
  "stream": false,
  "think": false,
  "options": {
    "num_ctx": 16384,
    "temperature": 0,
    "num_predict": 2048
  }
}
 */

export type OllamaChatMessageType = {
  role: "system" | "user";
  content: string;
};

export type OllamaChatOptionsType = {
  num_ctx?: number;
  temperature?: number;
  num_predict?: number;
};

export type OllamaChatInputType = {
  model: string;
  messages: OllamaChatMessageType[];
  format?: object;
  think?: boolean;
  options?: OllamaChatOptionsType;
};

// for prompt quality and token usage debugging
export type OllamaPromptDebugType = {
  promptEvalCount?: number;
  evalCount?: number;
  doneReason?: string;
};

// used in our app -> chat client response
export type LLMChatResponseType = {
  model: string;
  content: string;
  promptEvalCount?: number;
  evalCount?: number;
  doneReason?: string;
};

// raw response returned by Ollama api
export type OllamaChatNativeApiResponseType = {
  model?: unknown;
  message?: {
    content?: unknown;
  };
  prompt_eval_count?: unknown; // request prompt tokens: system + format + user-input
  eval_count?: unknown; // tokens generated for answer

  // reasons ollama stops generating `done` or `length`
  // since we cap with num_predict: 3_072 in llm.config.ts
  done_reason?: unknown;
};
