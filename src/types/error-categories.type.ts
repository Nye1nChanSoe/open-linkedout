/**
 * Stable application error categories used by
 * retry policies and the scheduler.
 */
export type ApplicationErrorCodeType =
  | "NETWORK_ERROR"
  | "SCRAPE_TIMEOUT"
  | "BROWSER_ERROR"
  | "AUTHENTICATION_ERROR"
  | "DATABASE_BUSY"
  | "DATABASE_ERROR"
  | "LLM_UNAVAILABLE"
  | "LLM_INVALID_RESPONSE"
  | "INVALID_SCRAPED_DATA"
  | "UNKNOWN_ERROR";

// Normally retryable
// ------------------
// NETWORK_ERROR      temporary browser or network connection failure
// SCRAPE_TIMEOUT     LinkedIn page did not settle in time
// BROWSER_ERROR      temporary Playwright/browser failure
// DATABASE_BUSY      SQLite is temporarily locked
// LLM_UNAVAILABLE    Ollama is offline, busy, rate limited, or returned 5xx

// Normally non-retryable
// ----------------------
// AUTHENTICATION_ERROR    LinkedIn requires a manual browser login
// INVALID_SCRAPED_DATA    Required LinkedIn data is unavailable or malformed
// DATABASE_ERROR          SQLite schema or query failure
// LLM_INVALID_RESPONSE    Ollama response cannot be parsed or validated
// UNKNOWN_ERROR           Unclassified application failure
