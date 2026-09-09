import { chromium, type BrowserContext, type Page } from "playwright";

import scraperConfig from "@/config/scraper.config.js";
import { debugDOMLogs } from "@/utils/utils.js";

/**
 * Owns the one persistent Chromium context the scraper works in.
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
    // alive -> return the page
    if (this.isAlive()) return this.page!;
    // dead -> discard and then relaunch
    if (this.page) this.discard();

    // Concurrent callers must not launch two browsers against the same
    // persistent profile directory.
    this.launch ??= this.launchPage();

    return this.launch;
  }

  /**
   * Whether the open browser can still be driven.
   * - do i have a page?
   * - does this page still open?
   * - does the browser belongs to the page still connected?
   * @returns Whether a usable page is open.
   */
  isAlive(): boolean {
    if (!this.page || this.page.isClosed()) return false;

    return this.context?.browser()?.isConnected() ?? true;
  }

  /**
   * Whether a BrowserSession instance still exists in node side.
   * call discard() to clear
   */
  isOpen(): boolean {
    return this.context !== undefined;
  }

  /**
   * Closes the browser if one was opened.
   * Physically shuts the Chromium down.
   */
  async close(): Promise<void> {
    await this.context?.close().catch(() => undefined);

    this.discard();
  }

  /**
   * Forgets a browser that is already gone, so the next `getPage` relaunches.
   */
  private discard(): void {
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
