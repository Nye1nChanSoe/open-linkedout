import pc from "picocolors";
import { randomDelay, toScrapingError } from "@/utils/utils.js";
import { JobsSearchPage } from "./job-search-page.js";
import type { ScrapedJobType } from "@/types/scraped-job.type.js";
import { extractJobCardData } from "@/pages/search/extractor.js";

export class Scroller {
  // deduplicator
  private readonly processedJobIds = new Set<string>();

  constructor(private readonly jobSearchPage: JobsSearchPage) {}

  async autoScrapeCurrentPage(): Promise<ScrapedJobType[]> {
    try {
      await this.jobSearchPage.waitForFirstVirtualizedJobCard();
      await this.jobSearchPage.waitForFirstHydratedJobCard();

      const jobs: ScrapedJobType[] = [];
      const pageJobIds = new Set<string>();
      const vSlots = await this.jobSearchPage.virtualizedJobCardCount();

      console.info(pc.cyan(`${vSlots} virtualized slots found.`));

      for (let index = 0; index < vSlots; index++) {
        const job = await this.scrollAndExtract(index);

        if (
          this.processedJobIds.has(job.jobId) ||
          pageJobIds.has(job.jobId)
        ) {
          console.info(pc.yellow(`Already collected job: ${job.jobId}`));
          continue;
        }

        pageJobIds.add(job.jobId);
        jobs.push(job);
      }

      for (const job of jobs) {
        this.processedJobIds.add(job.jobId);
      }

      return jobs;
    } catch (error) {
      throw toScrapingError(error);
    }
  }

  /**
   * Scroll each card and extract job data
   * using external `extractJobCardData` method
   */
  private async scrollAndExtract(index: number): Promise<ScrapedJobType> {
    const slot = this.jobSearchPage.virtualizedJobCardAt(index);
    await slot.waitFor({ state: "attached", timeout: 1000 });
    await slot.scrollIntoViewIfNeeded({ timeout: 1000 });

    // Brief center-weighted pause between job cards.
    await slot.page().waitForTimeout(randomDelay());

    const refreshedSlot = this.jobSearchPage.virtualizedJobCardAt(index);
    const hydratedCard = this.jobSearchPage.hydratedJobCard(refreshedSlot);
    await hydratedCard.waitFor({ state: "attached", timeout: 1_000 });

    const job = await extractJobCardData(hydratedCard);
    console.info(
      pc.green("Extracted"),
      pc.dim(":"),
      pc.green(job.title),
      pc.dim("|"),
      pc.blue(`(${job.jobId})`),
    );

    return job;
  }
}
