import { JobType } from "@/types/job.type.js";
import { Paginator } from "./paginator.js";
import { Scroller } from "./scroller.js";

export class Scraper {
  constructor(
    private readonly scroller: Scroller,
    private readonly paginator: Paginator,
  ) {}

  async autoScrape(maxPages = 5): Promise<JobType[]> {
    const jobs: JobType[] = [];

    for (let page = 1; page <= maxPages; page++) {
      console.info(`Scraping page ${page}/${maxPages}...`);

      const currentPageJobs = await this.scroller.autoScrapeCurrentPage();

      jobs.push(...currentPageJobs);

      if (!(await this.paginator.hasNextPage())) {
        console.info("Reached the last available page.");
        break;
      }

      await this.paginator.goToNextPage();
    }

    return jobs;
  }
}
