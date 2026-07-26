import { chromium, type Page } from "playwright";
import scraperConfig from "@/config/scraper.config.js";
import domEventConfig from "@/config/dom-event.config.js";
import {
  buildURLParams,
  resolveProjectPath,
  debugDOMLogs,
} from "@/utils/utils.js";
import { JobsSearchPage } from "@/pages/search/job-search-page.js";
import { Scroller } from "@/pages/search/scroller.js";
import { Paginator } from "@/pages/search/paginator.js";
import { Scraper } from "@/pages/search/scraper.js";

const context = await chromium.launchPersistentContext(
  resolveProjectPath(scraperConfig.PERSISTENT_BROWSER_DATA_PATH),
  {
    headless: scraperConfig.IS_HEADLESS,
    viewport: null,
  },
);

const page = context.pages()[0] ?? (await context.newPage());
await debugDOMLogs(page);

await page.bringToFront();

await page.goto(
  buildURLParams(
    scraperConfig.SCRAPE_SITE_URLS.JOB_SEARCH,
    "software engineer",
    "bangkok",
  ),
  {
    waitUntil: domEventConfig.EVENT_DOMCONTENTLOADED,
  },
);

/**
 * Waits for manual authentication when LinkedIn redirects to a sign-in page.
 * @param page - Active LinkedIn Playwright page.
 * @returns A promise that resolves when authentication is not required.
 */
export async function assertAuthenticated(page: Page): Promise<void> {
  const authenticationPaths = ["/login", "/checkpoint", "/authwall"];

  const isAuthenticationRequired = (url: string): boolean =>
    authenticationPaths.some((path) => url.includes(path));

  if (!isAuthenticationRequired(page.url())) {
    const didRedirectToAuthentication = await page
      .waitForURL((url) => isAuthenticationRequired(url.toString()), {
        waitUntil: domEventConfig.EVENT_COMMIT_PW,
        timeout: scraperConfig.AUTH_REDIRECT_GRACE_MS,
      })
      .then(() => true)
      .catch(() => false);

    if (!didRedirectToAuthentication) {
      return;
    }
  }

  if (scraperConfig.IS_HEADLESS) {
    throw new Error("Manual LinkedIn authentication requires headless: false.");
  }

  console.warn(
    "\nLinkedIn authentication required.\n" +
      "Enter your credentials in the opened browser window.\n" +
      "Waiting for sign-in to complete...\n",
  );

  await page.waitForURL((url) => !isAuthenticationRequired(url.toString()), {
    waitUntil: domEventConfig.EVENT_DOMCONTENTLOADED,
    timeout: scraperConfig.MANUAL_AUTH_TIMEOUT_MS,
  });

  console.info("LinkedIn authentication completed. Continuing scraper.");
}

/**
 * Closes LinkedIn's contextual sign-in modal when it is displayed.
 * NOTE: probably this will be removed later
 * @param page - Active LinkedIn Playwright page.
 * @returns Whether the modal was found and dismissed.
 */
export async function dismissContextualSignInModal(
  page: Page,
): Promise<boolean> {
  const modalHeader = page.locator(
    "#base-contextual-sign-in-modal-modal-header",
  );

  const isModalVisible = await modalHeader
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);

  if (!isModalVisible) {
    return false;
  }

  const dismissButton = page
    .locator(
      [
        "button.contextual-sign-in-modal__modal-dismiss",
        'button[data-tracking-control-name="public_jobs_contextual-sign-in-modal_modal_dismiss"]',
      ].join(", "),
    )
    .first();

  if (await dismissButton.isVisible()) {
    await dismissButton.click();
  } else {
    await page.keyboard.press("Escape");
  }

  await modalHeader.waitFor({ state: "hidden" });
  console.info("Closed LinkedIn contextual sign-in modal.");

  return true;
}

await assertAuthenticated(page);
await dismissContextualSignInModal(page);

const jobSearchPage = new JobsSearchPage(page);
const scroller = new Scroller(jobSearchPage);
const paginator = new Paginator(jobSearchPage);
const scraper = new Scraper(scroller, paginator);
await scraper.autoScrape(5);

// debugging
await new Promise(() => {});
