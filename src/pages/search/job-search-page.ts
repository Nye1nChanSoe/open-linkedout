import domEventConfig from "@/config/dom-event.config.js";
import searchPageLocatorConfig from "@/config/search-page-locators.config.js";
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

    this.virtualizedJobCards = page.locator(
      searchPageLocatorConfig.virtualizedCard,
    );
    this.hydratedJobCards = this.virtualizedJobCards.locator(
      searchPageLocatorConfig.hydratedCard,
    );

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

  /**
   * Returns the LinkedIn search pagination offset from the current URL.
   *
   * Page 1 normally has no `start` parameter, so it is treated as offset 0.
   */
  getCurrentStartOffset(): number {
    const url = new URL(this.page.url());
    const rawStartOffset = url.searchParams.get("start");

    if (rawStartOffset === null) return 0;

    const startOffset = Number(rawStartOffset);

    if (!Number.isInteger(startOffset) || startOffset < 0)
      throw new Error(
        `Invalid LinkedIn pagination offset: "${rawStartOffset}"`,
      );

    return startOffset;
  }

  /**
   * Creates a stable fingerprint from currently hydrated job-card IDs.
   *
   * This represents the rendered result snapshot, not the URL state.
   */
  async getHydratedJobFingerprint(): Promise<string> {
    await this.waitForFirstHydratedJobCard();
    const jobIds = await this.hydratedJobCards.evaluateAll(
      (cards, jobIdAttribute) =>
        cards
          .map((card) => card.getAttribute(jobIdAttribute))
          .filter((jobId): jobId is string => Boolean(jobId)),
      searchPageLocatorConfig.jobIdAttribute,
    );

    return jobIds.join("|");
  }

  /**
   * Waits until the currently rendered hydrated job cards differ from
   * a previous result snapshot.
   *
   * This is used to verify that LinkedIn has rendered a new search page,
   * not just updated the URL or pagination state.
   *
   * @param previousFingerprint - Hydrated job-card fingerprint before navigation.
   * @param timeout - Maximum wait time in milliseconds.
   */
  async waitForHydratedJobFingerprintChange(
    previousFingerprint: string,
    timeout = 15_000,
  ): Promise<void> {
    await this.page.waitForFunction(
      ({ previousSnapshot, virtualizedCard, hydratedCard, jobIdAttribute }) => {
        // Collect the currently rendered hydrated job IDs.
        const jobIds = Array.from(
          document.querySelectorAll(`${virtualizedCard} ${hydratedCard}`),
        )
          .map((card) => card.getAttribute(jobIdAttribute))
          .filter((jobId): jobId is string => Boolean(jobId));

        // Wait until at least one hydrated job exists and the rendered
        // job snapshot differs from the previous page.
        return jobIds.length > 0 && jobIds.join("|") !== previousSnapshot;
      },
      {
        // Serialized and passed into the browser context because the callback
        // cannot directly access Node.js variables.
        previousSnapshot: previousFingerprint,
        virtualizedCard: searchPageLocatorConfig.virtualizedCard,
        hydratedCard: searchPageLocatorConfig.hydratedCard,
        jobIdAttribute: searchPageLocatorConfig.jobIdAttribute,
      },
      { timeout },
    );
  }

  /**
   * Navigates directly to a LinkedIn search URL.
   * @param url - LinkedIn URL to load.
   * @param timeout - Maximum navigation time in milliseconds.
   */
  async navigateToUrl(url: string, timeout = 15_000): Promise<void> {
    await this.page.goto(url, {
      waitUntil: domEventConfig.EVENT_DOMCONTENTLOADED,
      timeout,
    });
  }

  /**
   * Current page url
   */
  currentUrl(): string {
    return this.page.url();
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
