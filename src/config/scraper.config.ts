import { resolveProjectPath } from "@/utils/utils.js";

const config = {
  /**
   * For playwright chromium browser persistent
   */
  PERSISTENT_BROWSER_DATA_PATH: resolveProjectPath("./data/browser-data"),

  /**
   * Browser mode
   */
  IS_HEADLESS: false,

  /** Maximum time allowed for manual LinkedIn authentication. */
  MANUAL_AUTH_TIMEOUT_MS: 10 * 60 * 1000,

  /** Time allowed for a delayed LinkedIn authentication redirect. */
  AUTH_REDIRECT_GRACE_MS: 5_000,

  /** Number of results shown on each LinkedIn search page. */
  LINKEDIN_RESULTS_PER_PAGE: 25,

  /**
   * LinkedIn job-discovery pages.
   *
   * These routes can render different job-card markup, so keep them
   * separately addressable by the scraper.
   *
   * Please infer to examples for markup difference:
   */
  SCRAPE_SITE_URLS: {
    JOB_SEARCH: "https://www.linkedin.com/jobs/search",
    JOB_SEARCH_RESULTS: "https://www.linkedin.com/jobs/search-results",
  },
} as const;

export default config;
