import type { Page } from "playwright";
import pc from "picocolors";

import { RetryPolicy } from "@/app/retry/retry-policy.js";
import { PersistJobDetailService } from "@/app/services/persist-job-detail.service.js";
import domEventConfig from "@/config/dom-event.config.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import { extractJobDetailData } from "@/pages/view/extractor.js";
import { JobDetailPage } from "@/pages/view/job-detail-page.js";
import { assertAuthenticated } from "@/scraper/authentication.js";
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

    this.persistJobDetailService.execute({
      jobId: job.id,
      extractedJobDetail: await this.extractJobDetail(),
    });
  }

  /**
   * Waits for, opens, and extracts the LinkedIn job-detail page.
   * @returns Raw data extracted from the loaded job-detail page.
   */
  private async extractJobDetail(): Promise<ScrapedJobDetailType> {
    return this.retryPolicy.execute(
      { operationName: "extract LinkedIn job detail" },
      async () => {
        try {
          const jobDetailPage = new JobDetailPage(this.page);
          await jobDetailPage.waitForContent();
          await jobDetailPage.openMatchDetails();

          const extracted = await extractJobDetailData(jobDetailPage);

          console.info(
            pc.green("Extracted detail"),
            pc.dim(":"),
            pc.blue(extracted.sourceUrl),
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
