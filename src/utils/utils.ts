import path from "node:path";
import pc from "picocolors";
import { errors, type Page } from "playwright";
import { ScrapingError } from "@/app/errors/scraping-error.js";
import domeventConfig from "@/config/dom-event.config.js";
import type { RetryContextType } from "@/types/retry.type.js";

/**
 * Resolves a path relative to the project root.
 * @param segment - Path starting from the project root.
 * @returns Absolute path to the requested project location.
 */
export function resolveProjectPath(segment: string): string {
  return path.resolve(process.cwd(), segment);
}

/**
 * Builds the active LinkedIn /jobs/search URL.
 * @param url - LinkedIn job-search base URL.
 * @param job - Keyword and location pair.
 * @returns URL containing the encoded job-search parameters.
 */
export function buildSearchURLParams(
  url: string,
  keyword: string,
  location: string,
): string {
  const searchUrl = new URL(url);

  searchUrl.searchParams.set("keywords", keyword);
  searchUrl.searchParams.set("location", location);

  return searchUrl.toString();
}

/**
 * Builds the active LinkedIn /jobs/view/${job-id} URL.
 * @param url - LinkedIn job-search base URL.
 * @param jobID - LinkedIn Job ID
 * @returns URL containing the encoded job-view parameters.
 */
export function buildDetailViewURLParams(url: string, jobID: string): string {
  return new URL(jobID, url).toString();
}

export async function debugDOMLogs(page: Page) {
  page.on(domeventConfig.EVENT_FRAME_NAVIGATED_PW, (frame) => {
    if (frame === page.mainFrame()) {
      console.log(pc.cyan("[NAVIGATION]"), pc.dim(frame.url()));
    }
  });
  page.on(domeventConfig.EVENT_DOMCONTENTLOADED, () => {
    console.log(pc.blue("[DOM CONTENT LOADED]"), pc.dim(page.url()));
  });
  page.on(domeventConfig.EVENT_LOAD, () => {
    console.log(pc.green("[LOAD]"), pc.dim(page.url()));
  });

  await page.addInitScript(() => {
    // history api and these logs will run in browser so need listener for console.log for node: page.on()
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      console.log("[HISTORY pushState]", args[2]);
      return originalPushState(...args);
    };

    history.replaceState = (...args) => {
      console.log("[HISTORY replaceState]", args[2]);
      return originalReplaceState(...args);
    };
  });

  page.on("console", (message) => {
    const text = message.text();
    if (text.startsWith("[HISTORY")) console.log(pc.magenta(text));
  });
}

/**
 * Produces a center-weighted delay with modest natural variation.
 * @param minMs - Minimum delay in milliseconds.
 * @param maxMs - Maximum delay in milliseconds.
 * @returns A single delay duration in milliseconds.
 */
export function randomDelay(minMs = 350, maxMs = 950): number {
  const centerWeightedRandom = (Math.random() + Math.random()) / 2;

  return Math.round(minMs + centerWeightedRandom * (maxMs - minMs));
}

/**
 * Waits for a specified duration.
 * @param delayMs - Delay duration in milliseconds.
 */
export function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Formats operation details for a concise retry log.
 * @param context - Retry context for the failed operation.
 */
export function formatRetryContext(context: RetryContextType): string {
  if (context.pageNumber === undefined) {
    return context.operationName;
  }

  return `${context.operationName} on page ${context.pageNumber}`;
}

/**
 * Formats a duration for retry logs.
 * @param durationMs - Duration in milliseconds.
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) {
    return `${Math.ceil(durationMs / 1_000)}s`;
  }

  return `${Math.ceil(durationMs / 60_000)}m`;
}

/**
 * Converts low-level scraping failures into a classified application error.
 * @param error - Original Playwright or extraction error.
 */
export function toScrapingError(error: unknown): ScrapingError {
  if (error instanceof ScrapingError) {
    return error;
  }

  if (error instanceof errors.TimeoutError) {
    return new ScrapingError(
      "Timed out while scraping the LinkedIn results page.",
      "SCRAPE_TIMEOUT",
      true,
      error,
    );
  }

  if (isNetworkError(error)) {
    return new ScrapingError(
      "Network connection failed while scraping the LinkedIn results page.",
      "NETWORK_ERROR",
      true,
      error,
    );
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Unable to extract required field:")
  ) {
    return new ScrapingError(
      "LinkedIn returned a job card without required data.",
      "INVALID_SCRAPED_DATA",
      false,
      error,
    );
  }

  return new ScrapingError(
    "Failed while scraping the LinkedIn results page.",
    "BROWSER_ERROR",
    false,
    error,
  );
}

/**
 * Checks whether Playwright reported a browser-network failure.
 * @param error - Original error thrown by Playwright.
 */
function isNetworkError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("net::ERR_");
}
