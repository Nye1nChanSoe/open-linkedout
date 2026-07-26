import type { Locator, Page } from "playwright";

/**
 * Page object for LinkedIn's `/jobs/search` page.
 *
 * Owns search controls, job-card | search | pagination - locators,
 * and DOM result readiness checkers.
 *
 * Pagination behavior is handled separately by `Paginator`.
 * Scrolling behavior is handled separately by `Scroller`.
 */
export class JobsSearchPage {
  private readonly page: Page;

  /**
   * Search fields
   */
  readonly keywordInput: Locator;
  readonly locationInput: Locator;

  /**
   * Virtualized <li> containers.
   * A visible virtualized job does not necessarily contain a hydrated card.
   */
  readonly virtualizedJobCards: Locator;

  /**
   * Hydrated job cards currently present anywhere in the result list.
   */
  readonly hydratedJobCards: Locator;

  readonly filtersButton: Locator;
  readonly pagination: Locator;
  readonly nextPageButton: Locator;
  readonly currentPageButton: Locator;
  readonly pageState: Locator;

  /**
   * Creates a model for LinkedIn's jobs search page.
   * @param page - Active LinkedIn Playwright page.
   */
  constructor(page: Page) {
    this.page = page;

    this.keywordInput = page.getByLabel("Search by title, skill, or company");
    this.locationInput = page.getByLabel("City, state, or zip code");

    this.virtualizedJobCards = page.locator("li[data-occludable-job-id]");
    this.hydratedJobCards =
      this.virtualizedJobCards.locator("div[data-job-id]");

    this.filtersButton = page.getByRole("button", {
      name: "All filters",
    });

    /** Only one responsive pagination layout should be visible at a time. */
    this.pagination = page.locator(".jobs-search-pagination:visible").first();

    this.nextPageButton = this.pagination.getByRole("button", {
      name: "View next page",
    });

    this.currentPageButton = this.pagination.locator(
      'button[aria-current="page"]',
    );

    this.pageState = this.pagination.locator(
      ".jobs-search-pagination__page-state",
    );
  }

  async search(keyword: string, location: string) {
    await this.keywordInput.fill(keyword);
    await this.locationInput.fill(location);
    await this.locationInput.press("Enter");
  }

  /**
   * Waits until the first virtualized slot appears.
   * This does not confirm that any slot has been hydrated.
   */
  async waitForFirstVirtualizedJobCard(timeout = 15_000): Promise<void> {
    await this.virtualizedJobCards.first().waitFor({
      state: "visible",
      timeout,
    });
  }

  /**
   * Waits until the first hydrated job card appears.
   */
  async waitForFirstHydratedJobCard(timeout = 15_000): Promise<void> {
    await this.hydratedJobCards.first().waitFor({
      state: "visible",
      timeout,
    });
  }

  async virtualizedJobCardCount(): Promise<number> {
    return this.virtualizedJobCards.count();
  }

  virtualizedJobCardAt(index: number): Locator {
    return this.virtualizedJobCards.nth(index);
  }

  hydratedJobCard(slot: Locator): Locator {
    return slot.locator("div[data-job-id]");
  }

  hydratedJobCardAt(index: number): Locator {
    return this.hydratedJobCard(this.virtualizedJobCardAt(index));
  }

  async hydratedJobCardCount(): Promise<number> {
    return this.hydratedJobCards.count();
  }
}
