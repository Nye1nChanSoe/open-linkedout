import type { ApplicationErrorCodeType } from "@/types/error-categories.type.js";

/** Base error for failures that the application can classify and handle. */
export class ApplicationError extends Error {
  /**
   * @param message - Clear description of the failed operation.
   * @param code - Stable category used to decide how to handle the error.
   * @param retryable - Whether the orchestrator may retry the operation.
   * @param cause - Original lower-level error, when available.
   */
  constructor(
    message: string,
    public readonly code: ApplicationErrorCodeType,
    public readonly retryable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
