import pc from "picocolors";
import { ApplicationError } from "@/app/errors/application-error.js";
import retryConfig from "@/config/retry.config.js";
import type { ApplicationErrorCodeType } from "@/types/error-categories.type.js";
import type {
  RetryContextType,
  RetryPolicyOptionsType,
} from "@/types/retry.type.js";
import { formatDuration, formatRetryContext, sleep } from "@/utils/utils.js";
import { calculateExponentialBackoffDelay } from "./exponential-backoff.js";

/**
 * Codes that are retryable, but not by repeating the operation
 */
const NOT_RETRYABLE_IN_PLACE = new Set<ApplicationErrorCodeType>([
  "BROWSER_CLOSED",
]);

export class RetryPolicy {
  /**
   * @param options - Retry-window and exponential-backoff configuration.
   * @param sleepFunction - Delay function, replaceable for tests.
   * @param now - Clock function, replaceable for tests.
   */
  constructor(
    private readonly options: RetryPolicyOptionsType = retryConfig,
    private readonly sleepFunction: typeof sleep = sleep,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Executes an operation until it succeeds or retrying is no longer allowed.
   * @param context - Operation details included in retry logs.
   * @param operation - Synchronous or asynchronous operation to execute.
   * @returns The successful operation result.
   */
  async execute<T>(
    context: RetryContextType,
    operation: () => Promise<T> | T,
  ): Promise<T> {
    const startedAt = this.now();
    let retryAttempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof ApplicationError) || !error.retryable) {
          throw error;
        }

        if (NOT_RETRYABLE_IN_PLACE.has(error.code)) throw error;

        retryAttempt++;

        const elapsedMs = this.now() - startedAt;
        const delayMs = calculateExponentialBackoffDelay(
          retryAttempt,
          this.options.BACKOFF,
        );

        if (elapsedMs + delayMs > this.options.MAX_ELAPSED_MS) {
          throw error;
        }

        console.warn(
          pc.yellow(
            `[${error.code}] Retrying ${formatRetryContext(context)} in ${formatDuration(delayMs)} ` +
              `(retry ${retryAttempt}, elapsed ${formatDuration(elapsedMs)}).`,
          ),
        );

        await this.sleepFunction(delayMs);
      }
    }
  }
}
