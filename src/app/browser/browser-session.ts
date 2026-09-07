import { chromium, type BrowserContext, type Page } from "playwright";

import scraperConfig from "@/config/scraper.config.js";
import { debugDOMLogs } from "@/utils/utils.js";

/**
 * Owns the one persistent Chromium context the scraper works in.
 *
 * The context is launched on first use, never at startup: document work
 * runs in the same process and must not pay for a browser it never opens.
 */
export class BrowserSession {
  private context?: BrowserContext;
  private page?: Page;
  private launch?: Promise<Page>;

  /**
   * Returns the scraping page, launching the browser on first call.
   * @returns Active LinkedIn page.
   */
  async getPage(): Promise<Page> {
    if (this.page) return this.page;

    // Concurrent callers must not launch two browsers against the same
    // persistent profile directory.
    this.launch ??= this.launchPage();

    return this.launch;
  }

  /** Whether a browser is currently open. */
  isOpen(): boolean {
    return this.context !== undefined;
  }

  /**
   * Closes the browser if one was opened.
   */
  async close(): Promise<void> {
    await this.context?.close();

    this.context = undefined;
    this.page = undefined;
    this.launch = undefined;
  }

  private async launchPage(): Promise<Page> {
    const context = await chromium.launchPersistentContext(
      scraperConfig.PERSISTENT_BROWSER_DATA_PATH,
      {
        headless: scraperConfig.IS_HEADLESS,
        viewport: null,
      },
    );
    const page = context.pages()[0] ?? (await context.newPage());

    await debugDOMLogs(page);
    await page.bringToFront();

    this.context = context;
    this.page = page;

    return page;
  }
}
