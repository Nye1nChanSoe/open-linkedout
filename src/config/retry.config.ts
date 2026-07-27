import type { RetryPolicyOptionsType } from "@/types/retry.type.js";

const config = {
  /** Maximum total time spent retrying one operation. */
  MAX_ELAPSED_MS: 60 * 60 * 1_000,

  /** Exponential delay settings for retryable operations. */
  BACKOFF: {
    /** First retry waits 5 seconds. */
    INITIAL_DELAY_MS: 5_000,

    /** Each retry doubles the previous delay. */
    MULTIPLIER: 2,

    /** Delays never exceed 5 minutes. */
    MAX_DELAY_MS: 5 * 60 * 1_000,

    /** Each delay varies by up to 20%. */
    JITTER_RATIO: 0.2,
  },
} satisfies RetryPolicyOptionsType;

export default config;
