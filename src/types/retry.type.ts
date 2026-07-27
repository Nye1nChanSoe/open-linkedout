/** Context that identifies an operation in retry logs. */
export type RetryContextType = {
  operationName: string;
  pageNumber?: number;
};

export type ExponentialBackoffOptionsType = {
  INITIAL_DELAY_MS: number;
  MULTIPLIER: number;
  MAX_DELAY_MS: number;
  JITTER_RATIO?: number;
};

export type RetryPolicyOptionsType = {
  MAX_ELAPSED_MS: number;
  BACKOFF: ExponentialBackoffOptionsType;
};
