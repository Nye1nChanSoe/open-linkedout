/**
 * Canonical selectors for the LinkedIn `/jobs/search` sidebar job cards.
 *
 * IMPORTANT:
 * This object is the single source of truth for the scraper. If job extraction,
 * scrolling, hydration detection, or parsing suddenly starts failing after
 * previously working, inspect the `/jobs/search` page DOM and update these
 * selectors first.
 *
 * LinkedIn frequently performs A/B tests and UI changes, so changes to the
 * sidebar structure are the most likely cause of scraper regressions.
 */
const locatorConfig = {
  virtualizedCard: "li[data-occludable-job-id]",
  hydratedCard: "div[data-job-id]",

  jobIdAttribute: "data-job-id",
  url: 'a[href*="/jobs/view/"]',
  title: 'a[href*="/jobs/view/"] strong',
  company: ".artdeco-entity-lockup__subtitle",
  location:
    ".artdeco-entity-lockup__caption .job-card-container__metadata-wrapper > li:first-child",

  logoImage: ".job-card-list__logo img",

  postedAgo: "time",
  postedDateAttribute: "datetime",

  salary: ".job-card-container__metadata-wrapper > li:not(:first-child)",

  insights: ".job-card-container__job-insight-text",

  footerItems: ".job-card-container__footer-item",
  viewedState: ".job-card-container__footer-job-state",

  ariaHiddenContent: '[aria-hidden="true"]',
  visuallyHiddenContent: ".visually-hidden",
} as const;

export default locatorConfig;
