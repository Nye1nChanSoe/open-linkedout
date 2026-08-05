import type { OllamaChatOptionsType } from "@/types/ollama.type.js";

/**
 * Typical resume inference uses about
 * 3,150 input tokens and
 * up to 2,048 output tokens
 * = ~5,200 tokens total
 */

const llmConfig = {
  /**
   * Local models used by the application.
   * Resume and job inference share the same structured-output model.
   */
  MODELS: {
    /**
     * qwen3:4b   - 2.5 GB  (Most Reliable on mid-tier laptops)
     * context:   262,144
     */
    RESUME_INFERENCE: "qwen3:4b",
    JOB_INFERENCE: "qwen3:1.7b",

    /**
     * qwen3-embedding:0.6b - 639 MB
     * context:   32768
     */
    EMBEDDING: "qwen3-embedding:0.6b",
  },

  INFERENCE: {
    IS_THINKING: false,
    IS_STREAMING: false,

    OPTIONS: {
      /**
       * context suggestions:   8_192 | 16_384
       * reducing KV-cache memory and inference time.
       */
      num_ctx: 16_384,

      /**
       * no need for randomness
       * keep the model temperature 0 for highly deterministic structured extractions
       */
      temperature: 0,

      /** Caps structured output well above the expected 1,200–1,900 tokens. */
      num_predict: 3_072,
    } satisfies OllamaChatOptionsType,
  },
};

export default llmConfig;
