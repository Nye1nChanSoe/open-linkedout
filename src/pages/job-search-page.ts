import type { Locator, Page } from "playwright";

/**
 * Markup formats for /jobs/search page:\
 * JobsSearchPage\
├── search inputs\
├── virtualized-card locators\
├── hydrated-card locators\
├── basic readiness waits\
├── filters\
└── pagination controls
 */
export class JobsSearchPage {
  private readonly page: Page;

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
    await this.page.keyboard.press("Enter");
  }

  /**
   * Waits until LinkedIn creates at least one visible virtualized slot.
   * This does not confirm that any slot has been hydrated.
   */
  async waitForVirtualizedJobCards(timeout = 15_000): Promise<void> {
    await this.virtualizedJobCards.first().waitFor({
      state: "visible",
      timeout,
    });
  }

  /**
   * Waits until at least one job slot contains a hydrated card.
   */
  async waitForHydratedResults(timeout = 15_000): Promise<void> {
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

  /**
   * Gets the hydrated card inside a virtualized job card.
   * @param slot - Virtualized job-card locator.
   * @example jobsPage.hydratedJobCard(virtualizedJobCard)
   */
  hydratedJobCard(slot: Locator): Locator {
    return slot.locator("div[data-job-id]");
  }

  /**
   * Gets the hydrated card inside a virtualized job card by index.
   * @param index - Zero-based virtualized job-card position.
   * @example jobsPage.hydratedJobCardAt(0)
   */
  hydratedJobCardAt(index: number): Locator {
    return this.hydratedJobCard(this.virtualizedJobCardAt(index));
  }

  async hydratedJobCardCount(): Promise<number> {
    return this.hydratedJobCards.count();
  }

  /**
   * Gets the active pagination page number from its aria-label.
   * @returns Current one-based page number.
   */
  async getCurrentPageNumber(): Promise<number> {
    const ariaLabel = await this.currentPageButton.getAttribute("aria-label");
    const pageNumber = Number.parseInt(
      ariaLabel?.match(/^Page\s+(\d+)$/i)?.[1] ?? "",
      10,
    );

    if (Number.isNaN(pageNumber)) {
      throw new Error(`Unable to read current page number from "${ariaLabel}".`);
    }

    return pageNumber;
  }

  async hasNextPage(): Promise<boolean> {
    if ((await this.nextPageButton.count()) === 0) {
      return false;
    }

    return this.nextPageButton.isEnabled();
  }
}
