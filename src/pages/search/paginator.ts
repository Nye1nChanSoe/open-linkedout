import { JobsSearchPage } from "./job-search-page.js";
import { toScrapingError } from "@/utils/utils.js";

export class Paginator {
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

  async goToNextPage(timeout = 15_000): Promise<number> {
    try {
      const previousPageNumber = await this.getCurrentPageNumber();

      if (!(await this.hasNextPage())) {
        throw new Error(`Page ${previousPageNumber} has no next page.`);
      }

      const previousActivePage = this.jobSearchPage.pagination.locator(
        `button[aria-current="page"][aria-label="Page ${previousPageNumber}"]`,
      );

      await this.jobSearchPage.nextPageButton.click();

      await previousActivePage.waitFor({
        state: "hidden",
        timeout,
      });

      await this.jobSearchPage.waitForFirstVirtualizedJobCard(timeout);

      return this.getCurrentPageNumber();
    } catch (error) {
      throw toScrapingError(error);
    }
  }
}
