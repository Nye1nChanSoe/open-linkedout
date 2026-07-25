import { chromium } from "playwright";
import scraperConfig from "@/config/scraper.config.js";
import domEventConfig from "@/config/dom-event.config.js";
import { resolveProjectPath } from "@/utils/utils.js";

const context = await chromium.launchPersistentContext(
  resolveProjectPath(scraperConfig.PERSISTENT_BROWSER_DATA_PATH),
  {
    headless: scraperConfig.IS_HEADLESS,
    viewport: null,
  },
);

const page = context.pages()[0] ?? (await context.newPage());

await page.bringToFront();

await page.goto(scraperConfig.SCRAPE_SITE_URLS.JOB_SEARCH, {
  waitUntil: domEventConfig.EVENT_LOAD,
});

await page.waitForTimeout(60_000);
