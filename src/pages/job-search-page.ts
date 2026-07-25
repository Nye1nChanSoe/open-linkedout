import type { Locator, Page } from "playwright";

/**
 * Markup formats for /jobs/search page
 */
export class JobsSearchPage {
  private readonly page: Page;

  readonly keywordInput: Locator;
  readonly locationInput: Locator;
  readonly jobCardSlots: Locator;
  readonly filtersButton: Locator;

  /**
   * Creates a model for LinkedIn's jobs search page.
   * @param page - Active LinkedIn Playwright page.
   */
  constructor(page: Page) {
    this.page = page;

    /** refer to examples/searchbar/search-input.html for markup reference */
    this.keywordInput = page.getByLabel("Search by title, skill, or company");
    this.locationInput = page.getByLabel("City, state, or zip code");

    /**
     * LinkedIn creates these <li> elements as virtualized slots.
     * A slot is hydrated only when it contains a div[data-job-id].
     * Refer to examples/search/sidebar-component-card.html.
     */
    this.jobCardSlots = page.locator("li[data-occludable-job-id]");

    this.filtersButton = page.getByRole("button", {
      name: "All filters",
    });
  }

  async search(keyword: string, location: string) {
    await this.keywordInput.fill(keyword);
    await this.locationInput.fill(location);
    await this.page.keyboard.press("Enter");
  }

  /** Waits for the first job-card slot to become visible, not hydrated. */
  async waitForResults() {
    await this.jobCardSlots
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  }

  async jobCardSlotCount() {
    return this.jobCardSlots.count();
  }

  /**
   * Gets a virtualized job-card slot by position.
   * @param index - Zero-based slot position.
   * @returns Locator for the requested job-card slot.
   */
  jobCardSlot(index: number) {
    return this.jobCardSlots.nth(index);
  }
}
