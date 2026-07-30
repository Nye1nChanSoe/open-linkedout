import type { Locator, Page } from "playwright";
import detailPageLocatorConfig from "@/config/detail-page-locators.config.js";

/**
 * Page object for LinkedIn's `/jobs/view/:jobId` page.
 *
 * Owns job-detail locators, DOM readiness checks, and the Show Match Details
 * interaction. Extraction is handled separately by the detail extractor.
 */
export class JobDetailPage {
  readonly jobHeader: Locator;
  readonly description: Locator;
  readonly showMatchDetailsLink: Locator;
  readonly matchDetailsText: Locator;

  /**
   * @param page - Active LinkedIn Playwright page.
   */
  constructor(private readonly page: Page) {
    this.jobHeader = page
      .locator(detailPageLocatorConfig.jobHeaderCandidate)
      .filter({ has: page.locator(detailPageLocatorConfig.company) })
      .first();
    this.description = page
      .locator(detailPageLocatorConfig.description)
      .first();
    this.showMatchDetailsLink = page.locator(
      detailPageLocatorConfig.matchDetailsTrigger,
    );
    this.matchDetailsText = page
      .locator(detailPageLocatorConfig.matchDetailsText)
      .first();
  }

  /**
   * Waits until the required job-detail content is visible and non-empty.
   * @param timeout - Maximum wait time in milliseconds.
   */
  async waitForContent(timeout = 15_000): Promise<void> {
    await this.jobHeader
      .filter({ hasText: /\S/ })
      .waitFor({ state: "visible", timeout });
    await this.description
      .filter({ hasText: /\S/ })
      .waitFor({ state: "visible", timeout });
  }

  /**
   * Opens LinkedIn's Show Match Details panel and waits for its AI response.
   * @param timeout - Maximum wait time in milliseconds.
   */
  async openMatchDetails(timeout = 15_000): Promise<void> {
    await this.showMatchDetailsLink.waitFor({ state: "visible", timeout });
    await this.showMatchDetailsLink.click();
    await this.matchDetailsText
      .filter({ hasText: /\S/ })
      .waitFor({ state: "visible", timeout });
  }

  /**
   * @returns Current page URL.
   */
  currentUrl(): string {
    return this.page.url();
  }
}
