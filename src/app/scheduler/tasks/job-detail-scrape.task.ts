import { errors, type Page } from "playwright";
import pc from "picocolors";

import { ScrapingError } from "@/app/errors/scraping-error.js";
import { RetryPolicy } from "@/app/retry/retry-policy.js";
import { PersistJobDetailService } from "@/app/services/persist-job-detail.service.js";
import domEventConfig from "@/config/dom-event.config.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import { extractJobDetailData } from "@/pages/view/extractor.js";
import { JobDetailPage } from "@/pages/view/job-detail-page.js";
import { assertAuthenticated } from "@/scraper/authentication.js";
import type { JobApplicationStatusType } from "@/types/job-detail.type.js";
import type { ScrapedJobDetailType } from "@/types/scraped-job.type.js";
import type {
  DBSchedulerTaskRowType,
  JobDetailScrapeTaskPayloadType,
} from "@/types/scheduler-task.type.js";
import { toScrapingError } from "@/utils/utils.js";
import { JobRepository } from "@database/repositories/job.repository.js";

/**
 * Executes scheduled scraping for ONE LinkedIn job-detail page.
 */
export class JobDetailScrapeTask implements SchedulerTaskContract {
  readonly taskType = "job_detail_scrape" as const;

  constructor(
    private readonly jobRepository: JobRepository,
    private readonly persistJobDetailService: PersistJobDetailService,
    private readonly page: Page,
    private readonly retryPolicy: RetryPolicy,
  ) {}

  /**
   * Executes one claimed job-detail scrape task.
   * @param task - Durable task row currently in the running state.
   */
  async execute(task: DBSchedulerTaskRowType): Promise<void> {
    const payload = JSON.parse(
      task.payload_json,
    ) as JobDetailScrapeTaskPayloadType;
    const job = this.jobRepository.findById(payload.job_id);

    if (!job) {
      throw new Error(
        `Cannot scrape details: canonical job ${payload.job_id} no longer exists.`,
      );
    }

    await this.navigateToJobDetail(job.canonical_url);
    await assertAuthenticated(this.page);

    const jobDetailPage = new JobDetailPage(this.page);
    const applicationStatus = await this.classifyPage(jobDetailPage);

    // A job that no longer takes applications is recorded and not read
    if (applicationStatus !== "open") {
      console.info(
        pc.yellow("Skipped detail"),
        pc.dim(":"),
        pc.cyan(`job ${job.id}`),
        pc.dim("|"),
        pc.cyan(applicationStatus),
      );

      this.persistJobDetailService.execute({
        jobId: job.id,
        extractedJobDetail: {
          headerText: "",
          descriptionText: "",
          sourceUrl: jobDetailPage.currentUrl(),
          applicationStatus,
        },
      });

      return;
    }

    this.persistJobDetailService.execute({
      jobId: job.id,
      extractedJobDetail: await this.extractJobDetail(jobDetailPage),
    });
  }

  /**
   * Opens and extracts one job-detail page that still takes applications.
   * @param jobDetailPage - Page object for the loaded LinkedIn job detail.
   * @returns Raw data extracted from the loaded job-detail page.
   */
  private async extractJobDetail(
    jobDetailPage: JobDetailPage,
  ): Promise<ScrapedJobDetailType> {
    return this.retryPolicy.execute(
      { operationName: "extract LinkedIn job detail" },
      async () => {
        try {
          await jobDetailPage.openMatchDetails();

          const extracted = await extractJobDetailData(jobDetailPage, "open");

          console.info(
            pc.green("Extracted detail"),
            pc.dim(":"),
            pc.cyan(extracted.applicationStatus),
            pc.dim("|"),
            pc.cyan(`${extracted.headerText.length} header chars`),
            pc.dim("|"),
            pc.cyan(`${extracted.descriptionText.length} description chars`),
            pc.dim("|"),
            extracted.linkedinShowMatchDetailsAiText
              ? pc.cyan(
                  `${extracted.linkedinShowMatchDetailsAiText.length} AI match chars`,
                )
              : pc.yellow("no AI match"),
          );

          return extracted;
        } catch (error) {
          throw toScrapingError(error);
        }
      },
    );
  }

  /**
   * Classifies the loaded page as open, closed, or unavailable.
   *
   * A settled DOM does not change on a repeat, so this is not retried: a
   * timeout means the page reached no outcome this application recognises.
   * @param jobDetailPage - Page object for the loaded LinkedIn job detail.
   */
  private async classifyPage(
    jobDetailPage: JobDetailPage,
  ): Promise<JobApplicationStatusType> {
    try {
      return await jobDetailPage.waitForContent();
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) {
        throw toScrapingError(error);
      }

      throw new ScrapingError(
        "LinkedIn job detail page has an unrecognised layout.",
        "INVALID_SCRAPED_DATA",
        false,
        error,
      );
    }
  }

  /**
   * Navigates to one discovered LinkedIn job-detail URL.
   * @param url - Canonical LinkedIn job-detail URL saved during discovery.
   */
  private async navigateToJobDetail(url: string): Promise<void> {
    await this.retryPolicy.execute(
      { operationName: "navigate to LinkedIn job detail" },
      async () => {
        try {
          await this.page.goto(url, {
            waitUntil: domEventConfig.EVENT_DOMCONTENTLOADED,
          });
        } catch (error) {
          throw toScrapingError(error);
        }
      },
    );
  }
}
