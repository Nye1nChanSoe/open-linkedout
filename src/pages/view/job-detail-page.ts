import type { Locator, Page } from "playwright";
import { detailLocatorConfig as locator } from "@/config/linkedin-locators.config.js";
import type { JobApplicationStatusType } from "@/types/job-detail.type.js";

/**
 * Page object for LinkedIn's `/jobs/view/:jobId` page.
 *
 * Owns job-detail locators, DOM readiness checks, and the Show Match Details
 * interaction. Extraction is handled separately by the detail extractor.
 */
export class JobDetailPage {
  readonly description: Locator;
  readonly unavailableMarker: Locator;
  readonly applyActions: Locator;
  readonly externalApplyLink: Locator;
  readonly showMatchDetailsLink: Locator;
  readonly matchDetailsText: Locator;

  constructor(private readonly page: Page) {
    this.description = page.locator(locator.aboutTheJob).first();

    this.unavailableMarker = page.locator(locator.unavailableMarker).first();

    this.applyActions = page.locator(locator.applyActions);

    this.externalApplyLink = page.locator(locator.externalApplyLink).first();

    this.showMatchDetailsLink = page.locator(locator.matchDetailsTrigger);

    this.matchDetailsText = page.locator(locator.matchDetailsText).first();
  }

  /**
   * Waits for whichever known outcome the page reaches, then classifies it.
   *
   * A timeout here means the page reached no outcome this application knows
   * about, which is the only case worth failing on.
   * @param timeout - Maximum wait time in milliseconds.
   * @returns Availability of the application on the loaded page.
   */
  async waitForContent(timeout = 10_000): Promise<JobApplicationStatusType> {
    await this.description
      .or(this.unavailableMarker)
      .first()
      .waitFor({ state: "visible", timeout });

    if (!(await this.description.isVisible())) return "unavailable";

    return (await this.applyActions.count()) > 0 ? "open" : "closed";
  }

  /**
   * Finds the header block using the first anchor that matches.
   * @returns Header locator, or null when the page uses an unknown layout.
   */
  async findHeader(): Promise<Locator | null> {
    for (const candidate of locator.jobHeaderCandidates) {
      const header = this.page.locator(candidate).first();

      if ((await header.count()) > 0) return header;
    }

    return null;
  }

  /**
   * Opens LinkedIn's Show Match Details panel and waits for its AI response.
   *
   * The panel is an active-job feature, so its absence is not a failure.
   * @param timeout - Maximum wait time in milliseconds.
   */
  async openMatchDetails(timeout = 15_000): Promise<void> {
    const trigger = this.showMatchDetailsLink.first();
    const isPresent = await trigger
      .waitFor({ state: "visible", timeout })
      .then(() => true)
      .catch(() => false);

    if (!isPresent) return;

    await trigger.click();
    await this.matchDetailsText
      .filter({ hasText: /\S/ })
      .waitFor({ state: "visible", timeout })
      .catch(() => undefined);
  }

  /**
   * @returns Current page URL.
   */
  currentUrl(): string {
    return this.page.url();
  }
}
