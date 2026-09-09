import pc from "picocolors";
import { chromium, type BrowserContext, type Page } from "playwright";

import { AppEventBus } from "@/app/events/app-event-bus.js";
import { ScrapingError } from "@/app/errors/scraping-error.js";
import scraperConfig from "@/config/scraper.config.js";
import { debugDOMLogs } from "@/utils/utils.js";

/**
 * Owns the one persistent Chromium context the scraper works in.
 */
export class BrowserSession {
  private context?: BrowserContext;
  private page?: Page;
  private launch?: Promise<Page>;
  private cleanup?: Promise<void>;
  private isClosedByUser = false;

  constructor(private readonly appEventBus?: AppEventBus) {}

  /**
   * Returns the scraping page, launching the browser on first call.
   * @returns Active LinkedIn page.
   */
  async getPage(): Promise<Page> {
    // alive -> return the page
    if (this.isAlive()) return this.page!;
    // closed -> stay closed until someone asks to scrape again
    if (this.isPaused()) {
      throw new ScrapingError(
        "Scraping is paused: the browser was closed.",
        "BROWSER_CLOSED",
        false,
      );
    }

    // A browser that went away may still be exiting, and it holds the lock
    // on the profile directory until it has.
    await this.cleanup;
    this.cleanup = undefined;

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
   * Whether scraping is paused because the browser went away.
   *
   * A closed browser is not reopened on its own closing it is a deliberate act
   * @returns Whether scraping is paused.
   */
  isPaused(): boolean {
    if (this.isClosedByUser) return true;

    if (!this.isOpen() || this.isAlive()) return false;

    this.isClosedByUser = true;
    this.cleanup = this.terminate();

    console.warn(
      pc.yellow("Scraping paused"),
      pc.dim(":"),
      "the browser was closed. Start a campaign to resume.",
    );

    this.appEventBus?.publish({ type: "browser.closed" });

    return true;
  }

  /**
   * Lets the browser open again. Called when scraping is explicitly asked
   * for, which is the only thing that may reopen a closed window.
   */
  resume(): void {
    this.isClosedByUser = false;
  }

  /**
   * Ends the Chromium process behind a browser that has gone away.
   *
   * Forgetting the references is not enough. Closing a window does not end
   * the process, and while it lives it holds `SingletonLock` on the profile
   * directory — the next launch is then handed off to it and exits at once,
   * leaving Playwright wired to a process that is already gone. The symptom
   * is a browser window that appears with no page behind it.
   */
  private async terminate(): Promise<void> {
    const context = this.context;

    this.discard();

    await context?.close().catch(() => undefined);
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
