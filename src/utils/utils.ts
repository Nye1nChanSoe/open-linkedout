import path from "node:path";
import type { Page } from "playwright";
import domeventConfig from "@/config/dom-event.config.js";

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
export function buildURLParams(
  url: string,
  keyword: string,
  location: string,
): string {
  const searchUrl = new URL(url);

  searchUrl.searchParams.set("keywords", keyword);
  searchUrl.searchParams.set("location", location);

  return searchUrl.toString();
}

export async function debugDOMLogs(page: Page) {
  page.on(domeventConfig.EVENT_FRAME_NAVIGATED_PW, (frame) => {
    if (frame === page.mainFrame()) {
      console.log("[NAVIGATION]", frame.url());
    }
  });
  page.on(domeventConfig.EVENT_DOMCONTENTLOADED, () => {
    console.log("[DOM CONTENT LOADED]", page.url());
  });
  page.on(domeventConfig.EVENT_LOAD, () => {
    console.log("[LOAD]", page.url());
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
    if (text.startsWith("[HISTORY")) console.log(text);
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
