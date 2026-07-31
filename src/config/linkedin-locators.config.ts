// Source of truth for LinkedIn Locators
// IF something breaks during scrape or fails this file should be something
// we should first consider to check with the examples -> html files snapshots
// and current LinkedIN HTML formats and locators

/**
 * Canonical selectors for LinkedIn `/jobs/search` sidebar job cards.
 */
export const searchLocatorConfig = {
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

/**
 * Canonical selectors for LinkedIn `/jobs/view/:jobId` detail pages.
 */
export const detailLocatorConfig = {
  root: '[data-testid="lazy-column"]',
  jobHeader: '[data-testid="lazy-column"] > div',
  company: '[aria-label^="Company,"]',
  saveJobButton: '[aria-label="Save the job"]',
  aboutTheJob: '[id^="JobDetails_AboutTheJob_"]',

  matchDetailsTrigger:
    'a[href*="/preload/guideOverlay/"]:has-text("Show match details")',
  matchDetailsText: "section.coach-message-ai-response .coach-message__text",
} as const;
