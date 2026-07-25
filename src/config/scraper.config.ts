const config = {
  /**
   * For playwright chromium browser persistent
   */
  PERSISTENT_BROWSER_DATA_PATH: "./data/browser-data",

  /**
   * Browser mode
   */
  IS_HEADLESS: false,

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
