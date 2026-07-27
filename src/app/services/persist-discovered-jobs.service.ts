import { JobDiscoveryRepository } from "@database/repositories/job-discovery.repository.js";
import { JobRepository } from "@database/repositories/job.repository.js";
import pc from "picocolors";
import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  PersistDiscoveredJobsInputType,
  PersistDiscoveredJobsResultType,
} from "@/types/persist-discovered-jobs.type.js";

/**
 * Atomic database write for ONE scraped page
 */
export class PersistDiscoveredJobsService {
  private readonly executeTransaction: (
    input: PersistDiscoveredJobsInputType,
  ) => PersistDiscoveredJobsResultType;

  /**
   * Creates the page-level discovered jobs persistence service.
   * @param database - Open SQLite database connection.
   * @param jobRepository - Repository for canonical jobs.
   * @param jobDiscoveryRepository - Repository for discovery observations.
   */
  constructor(
    database: DatabaseConnectionType,
    private readonly jobRepository: JobRepository,
    private readonly jobDiscoveryRepository: JobDiscoveryRepository,
  ) {
    this.executeTransaction = database.transaction(
      (
        input: PersistDiscoveredJobsInputType,
      ): PersistDiscoveredJobsResultType => this.saveDiscoveredJobs(input),
    );
  }

  /**
   * Saves one LinkedIn search-results page atomically.
   * @param input - Scraped jobs and their search-page context.
   * @returns Counts from the completed page save.
   */
  execute(
    input: PersistDiscoveredJobsInputType,
  ): PersistDiscoveredJobsResultType {
    const result = this.executeTransaction(input);

    console.info(
      pc.blueBright("Persisted:"),
      pc.cyan(`${result.uniqueJobCount} jobs`),
      pc.dim(
        `(${result.insertedJobCount} new, ${result.updatedJobCount} updated)`,
      ),
      pc.dim("|"),
      pc.cyan(
        `${result.insertedDiscoveryCount + result.updatedDiscoveryCount} discoveries`,
      ),
      pc.dim(
        `(${result.insertedDiscoveryCount} new, ${result.updatedDiscoveryCount} updated)`,
      ),
    );

    return result;
  }

  private saveDiscoveredJobs(
    input: PersistDiscoveredJobsInputType,
  ): PersistDiscoveredJobsResultType {
    // TODO: we could remove later since Scroller already handle deduplication
    const uniqueJobs = [
      ...new Map(input.jobs.map((job) => [job.jobId, job])).values(),
    ];

    let insertedJobCount = 0;
    let updatedJobCount = 0;
    let insertedDiscoveryCount = 0;
    let updatedDiscoveryCount = 0;

    for (const [index, scrapedJob] of uniqueJobs.entries()) {
      const jobResult = this.jobRepository.upsertJob({
        linkedinJobId: scrapedJob.jobId,
        title: scrapedJob.title,
        company: scrapedJob.company,
        location: scrapedJob.location,
        canonicalUrl: scrapedJob.url,
        logoImageUrl: scrapedJob.logoImageUrl,
        postedDate: scrapedJob.postedDate,
        postedAgo: scrapedJob.postedAgo,
        salaryText: scrapedJob.salary,
        insights: scrapedJob.insights,
        isViewed: scrapedJob.isViewed,
        isEasyApply: scrapedJob.isEasyApply,
        isEarlyApplicant: scrapedJob.isEarlyApplicant,
      });

      if (jobResult.wasInserted) {
        insertedJobCount++;
      } else {
        updatedJobCount++;
      }

      const discoveryResult = this.jobDiscoveryRepository.upsertDiscovery({
        jobId: jobResult.job.id,
        keyword: input.keyword,
        searchLocation: input.searchLocation,
        pageNumber: input.pageNumber,
        position: index + 1,
        isPromoted: scrapedJob.isPromoted,
      });

      if (discoveryResult.wasInserted) {
        insertedDiscoveryCount++;
      } else {
        updatedDiscoveryCount++;
      }
    }

    return {
      receivedCount: input.jobs.length,
      // TODO: we could remove later since Scroller already handle deduplication
      uniqueJobCount: uniqueJobs.length,
      insertedJobCount,
      updatedJobCount,
      insertedDiscoveryCount,
      updatedDiscoveryCount,
    };
  }
}
