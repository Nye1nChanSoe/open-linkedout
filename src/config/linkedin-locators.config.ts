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
  /**
   * The description slot is the only anchor observed on every job-view page.
   * It carries the job id and is what readiness waits on.
   */
  aboutTheJob: '[id^="JobDetails_AboutTheJob_"]',

  /**
   * Note the sibling `expandable-text-box` is deliberately NOT used as the
   * description anchor. LinkedIn nests <ul> inside the <p> that wraps it, and
   * the HTML parser closes both on the first <ul> — the box ends up holding
   * only the text before the first list.
   */
  descriptionExpandButton: '[data-testid="expandable-text-button"]',

  /**
   * Header anchors, tried in order. LinkedIn has moved this block out of the
   * lazy-column root at least once, so no single anchor is assumed and a
   * page that matches none is captured rather than failed.
   */
  jobHeaderCandidates: [
    '[data-testid="job-details-header"]',
    '[data-testid="lazy-column"] > div:not([id*="JobDetails"])',
  ],

  company: '[aria-label^="Company,"]',

  /**
   * Presence of any action decides `open` against `closed`. Each label is
   * matched in full: a bare "Apply" also appears inside similar-job cards.
   */
  applyActions: [
    '[aria-label="Save the job"]',
    '[aria-label^="Easy Apply"]',
    '[aria-label^="Apply on"]',
  ].join(", "),

  /** Only an anchor carries the outbound URL; the button form reveals it on click. */
  externalApplyLink: 'a[aria-label^="Apply on"]',

  /**
   * Secondary signal. Never matching costs nothing: readiness also resolves
   * on the description, and the action row decides the status either way.
   */
  unavailableMarker:
    "text=/no longer accepting applications|no longer available/i",

  matchDetailsTrigger:
    'a[href*="/preload/guideOverlay/"]:has-text("Show match details")',
  matchDetailsText: "section.coach-message-ai-response .coach-message__text",
} as const;
