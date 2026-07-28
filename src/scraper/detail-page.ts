import { chromium } from "playwright";
import pc from "picocolors";
import detailPageLocatorConfig from "@/config/detail-page-locators.config.js";
import scraperConfig from "@/config/scraper.config.js";
import domEventConfig from "@/config/dom-event.config.js";
import {
  buildDetailViewURLParams,
  debugDOMLogs,
  toScrapingError,
} from "@/utils/utils.js";
import { RetryPolicy } from "@/app/retry/retry-policy.js";
import { assertAuthenticated } from "./authentication.js";

const JOB_ID = "4401409527";

const context = await chromium.launchPersistentContext(
  scraperConfig.PERSISTENT_BROWSER_DATA_PATH,
  {
    headless: scraperConfig.IS_HEADLESS,
    viewport: null,
  },
);

const page = context.pages()[0] ?? (await context.newPage());
await debugDOMLogs(page);

const retryPolicy = new RetryPolicy();

await retryPolicy.execute(
  { operationName: `navigate to LinkedIn job view - ${JOB_ID}` },
  async () => {
    try {
      return await page.goto(
        buildDetailViewURLParams(
          scraperConfig.SCRAPE_SITE_URLS.JOB_DETAIL,
          JOB_ID,
        ),
        {
          waitUntil: domEventConfig.EVENT_DOMCONTENTLOADED,
        },
      );
    } catch (error) {
      throw toScrapingError(error);
    }
  },
);

await assertAuthenticated(page);

const jobHeader = page
  .locator(detailPageLocatorConfig.jobHeaderCandidate)
  .filter({ has: page.locator(detailPageLocatorConfig.company) })
  .first()
  .filter({ hasText: /\S/ });

await jobHeader.waitFor({ state: "visible" });
console.info(pc.cyan("Job header:"));
console.info(pc.gray(await jobHeader.innerText()));

const jobDetails = page
  .locator(detailPageLocatorConfig.description)
  .first()
  .filter({ hasText: /\S/ });

await jobDetails.waitFor({ state: "visible" });
console.info(pc.cyan("Job details:"));
console.info(pc.gray(await jobDetails.innerText()));

const showMatchDetails = page.locator(
  detailPageLocatorConfig.matchDetailsTrigger,
);

await showMatchDetails.waitFor({ state: "visible" });
await showMatchDetails.click();

const matchDetails = page
  .locator(detailPageLocatorConfig.matchDetailsText)
  .first()
  .filter({ hasText: /\S/ });

await matchDetails.waitFor({ state: "visible" });
console.info(pc.cyan("Match details:"));
console.info(pc.gray(await matchDetails.innerText()));

await new Promise(() => {});
