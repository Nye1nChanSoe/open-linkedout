import { ScrapeAndPersistOrchestratorService } from "@/app/services/scrape-and-persist-orchestrator.service.js";
import { RetryPolicy } from "@/app/retry/retry-policy.js";
import scraperConfig from "@/config/scraper.config.js";
import domEventConfig from "@/config/dom-event.config.js";
import type { SchedulerTaskWorkerType } from "@/contracts/scheduler-task-worker.contract.js";
import { assertAuthenticated } from "@/scraper/authentication.js";
import type {
  DBSchedulerTaskRowType,
  DiscoveryRunTaskPayloadType,
} from "@/types/scheduler-task.type.js";
import { buildURLParams, toScrapingError } from "@/utils/utils.js";
import type { Page } from "playwright";

/**
 * Executes complete LinkedIn discovery runs scheduled by the application.
 */
export class DiscoveryRunWorker implements SchedulerTaskWorkerType {
  readonly taskType = "discovery_run" as const;

  /**
   * @param scrapeAndPersistOrchestratorService - Runs the discovery workflow.
   * @param page - Active browser page used for the discovery run.
   * @param retryPolicy - Retries temporary navigation failures.
   */
  constructor(
    private readonly scrapeAndPersistOrchestratorService: ScrapeAndPersistOrchestratorService,
    private readonly page: Page,
    private readonly retryPolicy: RetryPolicy,
  ) {}

  /**
   * Executes one claimed discovery-run task.
   * @param task - Durable task row currently in the running state.
   */
  async execute(task: DBSchedulerTaskRowType): Promise<void> {
    const payload = JSON.parse(
      task.payload_json,
    ) as DiscoveryRunTaskPayloadType;

    await this.navigateToDiscoveryRun(payload);
    await assertAuthenticated(this.page);
    await this.scrapeAndPersistOrchestratorService.execute(payload);
  }

  /**
   * Navigates to the LinkedIn search URL for one discovery run.
   * @param payload - Search context and page limit for the discovery run.
   */
  private async navigateToDiscoveryRun(
    payload: DiscoveryRunTaskPayloadType,
  ): Promise<void> {
    await this.retryPolicy.execute(
      { operationName: "navigate to LinkedIn job search" },
      async () => {
        try {
          await this.page.goto(
            buildURLParams(
              scraperConfig.SCRAPE_SITE_URLS.JOB_SEARCH,
              payload.keyword,
              payload.searchLocation,
            ),
            { waitUntil: domEventConfig.EVENT_DOMCONTENTLOADED },
          );
        } catch (error) {
          throw toScrapingError(error);
        }
      },
    );
  }
}
