import type { ExponentialBackoffOptionsType } from "@/types/retry.type.js";

/**
 * Calculates a capped exponential retry delay with optional jitter.
 * @param retryAttempt - Retry attempt number, starting from one.
 * @param options - Exponential-backoff configuration.
 * @returns Delay duration in milliseconds.
 */
export function calculateExponentialBackoffDelay(
  retryAttempt: number,
  options: ExponentialBackoffOptionsType,
): number {
  const exponentialDelay =
    options.INITIAL_DELAY_MS * options.MULTIPLIER ** (retryAttempt - 1);
  const cappedDelay = Math.min(exponentialDelay, options.MAX_DELAY_MS);
  const jitterRatio = options.JITTER_RATIO ?? 0;
  const jitterMultiplier = 1 + (Math.random() * 2 - 1) * jitterRatio;

  return Math.round(
    Math.min(options.MAX_DELAY_MS, Math.max(0, cappedDelay * jitterMultiplier)),
  );
}
