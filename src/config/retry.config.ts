import type { RetryPolicyOptionsType } from "@/types/retry.type.js";

const config = {
  /** Maximum total duration for retrying one operation.
   * @example: 1 hour.
   */
  MAX_ELAPSED_MS: 60 * 60 * 1_000,

  /** Exponential backoff settings for retryable operations. */
  BACKOFF: {
    /** Delay before the first retry.
     * @example: 5 seconds.
     */
    INITIAL_DELAY_MS: 5_000,

    /** Factor applied to grow each following retry delay.
     * @example: 2 doubles the previous delay.
     */
    MULTIPLIER: 2,

    /** Maximum delay for one retry attempt.
     * @example: 5 minutes.
     */
    MAX_DELAY_MS: 5 * 60 * 1_000,

    /** Maximum random variation applied to each retry delay.
     * @example: 0.2 allows ±20% variation.
     */
    JITTER_RATIO: 0.2,
  },
} satisfies RetryPolicyOptionsType;

export default config;
