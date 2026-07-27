import pc from "picocolors";
import { JobsSearchPage } from "./job-search-page.js";
import type { ScrapedJobType } from "@/types/scraped-job.type.js";
import { extractJobCardData } from "@/pages/search/extractor.js";
import { randomDelay } from "@/utils/utils.js";

export class Scroller {
  // deduplicator
  private readonly processedJobIds = new Set<string>();

  constructor(private readonly jobSearchPage: JobsSearchPage) {}

  async autoScrapeCurrentPage(): Promise<ScrapedJobType[]> {
    await this.jobSearchPage.waitForFirstVirtualizedJobCard();
    await this.jobSearchPage.waitForFirstHydratedJobCard();

    const jobs: ScrapedJobType[] = [];
    const vSlots = await this.jobSearchPage.virtualizedJobCardCount();

    console.info(pc.cyan(`${vSlots} virtualized slots found.`));

    for (let index = 0; index < vSlots; index++) {
      try {
        const job = await this.scrollAndExtract(index);

        if (this.processedJobIds.has(job.jobId)) {
          console.info(pc.yellow(`Already collected job: ${job.jobId}`));
          continue;
        }

        this.processedJobIds.add(job.jobId);
        jobs.push(job);
      } catch (error) {
        console.warn(`Failed to extract slot ${index}.`, error);
      }
    }

    return jobs;
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
