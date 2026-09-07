import { JobDiscoveryRepository } from "@database/repositories/job-discovery.repository.js";
import { JobRepository } from "@database/repositories/job.repository.js";
import pc from "picocolors";
import { PersistenceError } from "@/app/errors/persistence-error.js";
import { isDatabaseBusyError } from "@/utils/utils.js";
import type { DatabaseConnectionType } from "@/types/database.type.js";
import type { CanonicalJobIdType } from "@/types/job-repository.type.js";
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
    try {
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
    } catch (error) {
      const isDatabaseBusy = isDatabaseBusyError(error);

      throw new PersistenceError(
        `Failed to persist LinkedIn results page ${input.pageNumber}.`,
        isDatabaseBusy ? "DATABASE_BUSY" : "DATABASE_ERROR",
        isDatabaseBusy,
        error,
      );
    }
  }

  private saveDiscoveredJobs(
    input: PersistDiscoveredJobsInputType,
  ): PersistDiscoveredJobsResultType {
    let insertedJobCount = 0;
    let updatedJobCount = 0;
    let insertedDiscoveryCount = 0;
    let updatedDiscoveryCount = 0;
    const canonicalJobIds: CanonicalJobIdType[] = [];

    for (const [index, scrapedJob] of input.extractedJobs.entries()) {
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

      canonicalJobIds.push(jobResult.job.id);

      const discoveryResult = this.jobDiscoveryRepository.upsertDiscovery({
        jobId: jobResult.job.id,
        keyword: input.keyword,
        searchLocation: input.searchLocation,
        pageNumber: input.pageNumber,
        position: index + 1,
        isPromoted: scrapedJob.isPromoted,
        campaignId: input.campaignId,
      });

      if (discoveryResult.wasInserted) {
        insertedDiscoveryCount++;
      } else {
        updatedDiscoveryCount++;
      }
    }

    return {
      receivedCount: input.extractedJobs.length,
      uniqueJobCount: input.extractedJobs.length,
      insertedJobCount,
      updatedJobCount,
      insertedDiscoveryCount,
      updatedDiscoveryCount,
      canonicalJobIds,
    };
  }
}
