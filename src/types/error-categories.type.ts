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
  | "INVALID_SCRAPED_DATA"
  | "INVALID_RESUME_INPUT"
  | "EXTRACTOR_UNAVAILABLE"
  | "EXTRACTOR_OCR_UNAVAILABLE"
  | "EXTRACTION_FAILED"
  | "EXTRACTION_OUTPUT_ERROR"
  | "UNKNOWN_ERROR";

// Normally retryable
// ------------------
// NETWORK_ERROR      temporary browser or network connection failure
// SCRAPE_TIMEOUT     LinkedIn page did not settle in time
// BROWSER_ERROR      temporary Playwright/browser failure
// DATABASE_BUSY      SQLite is temporarily locked
// EXTRACTION_OUTPUT_ERROR   The extractor could not write its result

// Normally non-retryable
// ----------------------
// AUTHENTICATION_ERROR    LinkedIn requires a manual browser login
// INVALID_SCRAPED_DATA    Required LinkedIn data is unavailable or malformed
// DATABASE_ERROR          SQLite schema or query failure
// INVALID_RESUME_INPUT       Resume file is missing, unsupported, or unreadable
// EXTRACTOR_UNAVAILABLE      Extractor binary or model weights are not installed
// EXTRACTOR_OCR_UNAVAILABLE  Document needs OCR and Tesseract is not installed
// EXTRACTION_FAILED          Extraction is deterministic, so a repeat fails alike
// UNKNOWN_ERROR              Unclassified application failure
