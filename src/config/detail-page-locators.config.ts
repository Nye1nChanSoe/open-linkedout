/**
 * Canonical selectors for the LinkedIn `/jobs/view/:jobId` detail page.
 *
 * Update these selectors when LinkedIn changes the detail-page DOM.
 */
const locatorConfig = {
  detailRoot: '[data-testid="lazy-column"]',
  jobHeaderCandidate: '[data-testid="lazy-column"] > div',
  company: '[aria-label^="Company,"]',

  description: '[data-testid="expandable-text-box"]',

  matchDetailsTrigger:
    'a[href*="/preload/guideOverlay/"]:has-text("Show match details")',
  matchDetailsText:
    "section.coach-message-ai-response .coach-message__text",
} as const;

export default locatorConfig;
