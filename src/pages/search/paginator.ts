import { JobsSearchPage } from "./job-search-page.js";
import scraperConfig from "@/config/scraper.config.js";
import type { PaginatorPendingNavigationType } from "@/types/pagination-state.type.js";
import { toScrapingError } from "@/utils/utils.js";

/**
 * Paginator Responsibility
 *
 * getCurrentPageNumber()
 * hasNextPage()
 * clickNextPage() <-> goToNextPage()
 */
export class Paginator {
  private pendingNavigation: PaginatorPendingNavigationType | undefined;

  constructor(private readonly jobSearchPage: JobsSearchPage) {}

  async getCurrentPageNumber(): Promise<number> {
    try {
      const ariaLabel =
        await this.jobSearchPage.currentPageButton.getAttribute("aria-label");
      const pageNumber = Number.parseInt(
        ariaLabel?.match(/^Page\s+(\d+)$/i)?.[1] ?? "",
        10,
      );

      if (Number.isNaN(pageNumber)) {
        throw new Error(
          `Unable to read current page number from "${ariaLabel}".`,
        );
      }

      return pageNumber;
    } catch (error) {
      throw toScrapingError(error);
    }
  }

  async hasNextPage(): Promise<boolean> {
    try {
      if ((await this.jobSearchPage.nextPageButton.count()) === 0) return false;
      return this.jobSearchPage.nextPageButton.isEnabled();
    } catch (error) {
      throw toScrapingError(error);
    }
  }

  /**
   * Clicks LinkedIn's Next button from the current results page.
   */
  async clickNextPage(): Promise<void> {
    try {
      const currentPageNumber = await this.getCurrentPageNumber();

      if (!(await this.hasNextPage()))
        throw new Error(`Page ${currentPageNumber} has no next page.`);

      await this.jobSearchPage.nextPageButton.click();
    } catch (error) {
      throw toScrapingError(error);
    }
  }

  /**
   * Moves to the next LinkedIn results page and verifies fresh job-card data.
   * @param timeout - Maximum wait time for a fresh hydrated result snapshot.
   * @returns Confirmed LinkedIn page number after navigation.
   */
  async goToNextPage(timeout = 15_000): Promise<number> {
    try {
      if (!this.pendingNavigation) {
        this.pendingNavigation = await this.createPendingNavigation();
        await this.clickNextPage();
      } else {
        await this.jobSearchPage.navigateToUrl(
          this.pendingNavigation.targetUrl,
          timeout,
        );
      }

      await this.jobSearchPage.waitForHydratedJobFingerprintChange(
        this.pendingNavigation.originalHydratedJobFingerprint,
        timeout,
      );

      const pageNumber = await this.getCurrentPageNumber();
      this.pendingNavigation = undefined;

      return pageNumber;
    } catch (error) {
      throw toScrapingError(error);
    }
  }

  /**
   * Captures the target URL and current result snapshot before clicking Next.
   * @returns Pending next-page navigation state.
   */
  private async createPendingNavigation(): Promise<PaginatorPendingNavigationType> {
    const originalStartOffset = this.jobSearchPage.getCurrentStartOffset();
    const targetUrl = new URL(this.jobSearchPage.currentUrl());

    // optimistic saving :)
    targetUrl.searchParams.set(
      "start",
      String(originalStartOffset + scraperConfig.LINKEDIN_RESULTS_PER_PAGE),
    );

    return {
      targetUrl: targetUrl.toString(),
      originalHydratedJobFingerprint:
        await this.jobSearchPage.getHydratedJobFingerprint(),
    };
  }
}
