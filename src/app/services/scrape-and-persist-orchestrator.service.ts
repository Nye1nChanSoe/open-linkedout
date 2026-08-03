import { Paginator } from "@/pages/search/paginator.js";
import { Scroller } from "@/pages/search/scroller.js";
import { RetryPolicy } from "@/app/retry/retry-policy.js";
import type {
  ScrapeAndPersistOrchestratorInputType,
  ScrapeAndPersistOrchestratorResultType,
} from "@/types/scrape-and-persist-orchestrator.type.js";
import { PersistDiscoveredJobsService } from "./persist-discovered-jobs.service.js";
import { SchedulerTaskService } from "./scheduler-task.service.js";

/**
 * Orchestrator ONLY decide: run this operation(s) using the retry policy
 */
export class ScrapeAndPersistOrchestratorService {
  constructor(
    private readonly scroller: Scroller,
    private readonly paginator: Paginator,
    private readonly persistDiscoveredJobsService: PersistDiscoveredJobsService,
    private readonly retryPolicy: RetryPolicy,
    private readonly schedulerTaskService: SchedulerTaskService,
  ) {}

  /**
   * Scrapes and persists LinkedIn results ONE page at a time.
   * @param input - Search context and maximum number of pages to process.
   * @returns Aggregate counts from all processed pages.
   */
  async execute(
    input: ScrapeAndPersistOrchestratorInputType,
  ): Promise<ScrapeAndPersistOrchestratorResultType> {
    let scrapedPageCount = 0;
    let receivedCount = 0;
    let uniqueJobCount = 0;
    let insertedJobCount = 0;
    let updatedJobCount = 0;
    let insertedDiscoveryCount = 0;
    let updatedDiscoveryCount = 0;

    for (let pageIndex = 0; pageIndex < input.maxPages; pageIndex++) {
      const pageNumber = await this.retryPolicy.execute(
        { operationName: "read current page number" },
        () => this.paginator.getCurrentPageNumber(),
      );
      const jobs = await this.retryPolicy.execute(
        { operationName: "scrape current page", pageNumber },
        () => this.scroller.autoScrapeCurrentPage(),
      );

      const pageResult = await this.retryPolicy.execute(
        { operationName: "persist discovered jobs", pageNumber },
        () =>
          this.persistDiscoveredJobsService.execute({
            keyword: input.keyword,
            searchLocation: input.searchLocation,
            pageNumber,
            extractedJobs: jobs,
          }),
      );

      scrapedPageCount++;
      receivedCount += pageResult.receivedCount;
      uniqueJobCount += pageResult.uniqueJobCount;
      insertedJobCount += pageResult.insertedJobCount;
      updatedJobCount += pageResult.updatedJobCount;
      insertedDiscoveryCount += pageResult.insertedDiscoveryCount;
      updatedDiscoveryCount += pageResult.updatedDiscoveryCount;

      // NOTE: now we run the pipeline synchronously
      // After discovery_run -> each job_detail_scrape will be processed by the scheduler
      this.schedulerTaskService.batchCreateJobDetailScrapeTasks(
        pageResult.canonicalJobIds,
      );

      const hasNextPage = await this.retryPolicy.execute(
        { operationName: "check next page", pageNumber },
        () => this.paginator.hasNextPage(),
      );

      if (!hasNextPage) break;

      await this.retryPolicy.execute(
        { operationName: "navigate to next page", pageNumber },
        () => this.paginator.goToNextPage(),
      );
    }

    return {
      scrapedPageCount,
      receivedCount,
      uniqueJobCount,
      insertedJobCount,
      updatedJobCount,
      insertedDiscoveryCount,
      updatedDiscoveryCount,
    };
  }
}
