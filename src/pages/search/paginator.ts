import { JobsSearchPage } from "./job-search-page.js";
import scraperConfig from "@/config/scraper.config.js";
import type {
  PaginatorNavigationSnapshotType,
  PaginatorRecoveryStateType,
} from "@/types/pagination-state.type.js";
import { toScrapingError } from "@/utils/utils.js";

/**
 * Paginator Responsibility
 *
 * getCurrentPageNumber()
 * hasNextPage()
 * clickNextPage() <-> goToNextPage()
 */
export class Paginator {
  private pendingNavigationSnapshot:
    | PaginatorNavigationSnapshotType
    | undefined;

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
      const snapshot =
        this.pendingNavigationSnapshot ??
        (await this.createNavigationSnapshot());
      this.pendingNavigationSnapshot = snapshot;

      const recoveryState = await this.getRecoveryState(snapshot);

      if (recoveryState === "ORIGINAL_PAGE") {
        await this.clickNextPage();
        return await this.waitForTargetPageReady(snapshot, timeout);
      }

      if (recoveryState === "TARGET_PAGE_READY") {
        return await this.completeNavigation();
      }

      if (recoveryState === "TARGET_PAGE_STALE") {
        await this.jobSearchPage.reloadCurrentPage(timeout);
        return await this.waitForTargetPageReady(snapshot, timeout);
      }

      throw new Error(
        `LinkedIn moved to an unexpected pagination offset: ${this.jobSearchPage.getCurrentStartOffset()}.`,
      );
    } catch (error) {
      throw toScrapingError(error);
    }
  }

  /**
   * Captures the current result state before next-page navigation starts.
   * @returns Original and target offsets with the current job-card fingerprint.
   */
  private async createNavigationSnapshot(): Promise<PaginatorNavigationSnapshotType> {
    const originalStartOffset = this.jobSearchPage.getCurrentStartOffset();

    return {
      originalStartOffset,
      targetStartOffset:
        originalStartOffset + scraperConfig.LINKEDIN_RESULTS_PER_PAGE,
      originalHydratedJobFingerprint:
        await this.jobSearchPage.getHydratedJobFingerprint(),
    };
  }

  /**
   * Classifies the current page against an in-progress navigation snapshot.
   * @param snapshot - Original state captured before clicking Next.
   * @returns Recovery state for the current URL and rendered results.
   */
  private async getRecoveryState(
    snapshot: PaginatorNavigationSnapshotType,
  ): Promise<PaginatorRecoveryStateType> {
    const currentStartOffset = this.jobSearchPage.getCurrentStartOffset();

    if (currentStartOffset === snapshot.originalStartOffset) {
      return "ORIGINAL_PAGE";
    }

    if (currentStartOffset !== snapshot.targetStartOffset) {
      return "UNEXPECTED_PAGE";
    }

    const currentFingerprint =
      await this.jobSearchPage.getHydratedJobFingerprint();

    if (currentFingerprint === snapshot.originalHydratedJobFingerprint) {
      return "TARGET_PAGE_STALE";
    }

    return "TARGET_PAGE_READY";
  }

  /**
   * Waits for fresh results, then verifies that the target page is ready.
   * @param snapshot - Navigation state captured before clicking Next.
   * @param timeout - Maximum wait time for a changed result fingerprint.
   * @returns Confirmed LinkedIn page number after navigation.
   */
  private async waitForTargetPageReady(
    snapshot: PaginatorNavigationSnapshotType,
    timeout: number,
  ): Promise<number> {
    await this.jobSearchPage.waitForHydratedJobFingerprintChange(
      snapshot.originalHydratedJobFingerprint,
      timeout,
    );

    const recoveryState = await this.getRecoveryState(snapshot);

    if (recoveryState !== "TARGET_PAGE_READY") {
      throw new Error(
        `LinkedIn did not reach a ready target page: ${recoveryState}.`,
      );
    }

    return this.completeNavigation();
  }

  /**
   * Clears completed navigation state and returns the active LinkedIn page.
   * @returns Confirmed LinkedIn page number after navigation.
   */
  private async completeNavigation(): Promise<number> {
    const pageNumber = await this.getCurrentPageNumber();
    this.pendingNavigationSnapshot = undefined;

    return pageNumber;
  }
}
