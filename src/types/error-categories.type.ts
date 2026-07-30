/**
Scraper
    | throws scraping failures

PersistDiscoveredJobsService
    | throws persistence failures

ScrapeAndPersistOrchestratorService (BRAIN)
    | decides retryable vs non-retryable

main.ts
    | handles final unrecoverable failure
 */
export type ApplicationErrorCodeType =
  | "NETWORK_ERROR"
  | "SCRAPE_TIMEOUT"
  | "BROWSER_ERROR"
  | "AUTHENTICATION_ERROR"
  | "DATABASE_BUSY"
  | "DATABASE_ERROR"
  | "INVALID_SCRAPED_DATA"
  | "UNKNOWN_ERROR";

// Retryable
// ---------
// NETWORK_ERROR
// SCRAPE_TIMEOUT
// temporary BROWSER_ERROR
// DATABASE_BUSY            caused by locking

// Non-retryable
// -------------
// AUTHENTICATION_ERROR
// INVALID_SCRAPED_DATA
// DATABASE_ERROR            caused by schema mismatch
// UNKNOWN_ERROR             by default
