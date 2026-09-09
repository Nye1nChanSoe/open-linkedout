import { AppEventBus } from "@/app/events/app-event-bus.js";
import { CampaignService } from "@/app/services/campaign.service.js";
import { ScrapeAndPersistOrchestratorService } from "@/app/services/scrape-and-persist-orchestrator.service.js";
import { RetryPolicy } from "@/app/retry/retry-policy.js";
import scraperConfig from "@/config/scraper.config.js";
import domEventConfig from "@/config/dom-event.config.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import { assertAuthenticated } from "@/app/browser/authentication.js";
import type {
  DBSchedulerTaskRowType,
  DiscoveryRunTaskPayloadType,
} from "@/types/scheduler-task.type.js";
import { buildSearchURLParams, toScrapingError } from "@/utils/utils.js";
import type { Page } from "playwright";

/**
 * Executes complete LinkedIn discovery runs scheduled by the application.
 */
export class DiscoveryRunTask implements SchedulerTaskContract {
  readonly taskType = "discovery_run" as const;

  constructor(
    private readonly scrapeAndPersistOrchestratorService: ScrapeAndPersistOrchestratorService,
    private readonly page: Page,
    private readonly retryPolicy: RetryPolicy,
    private readonly campaignService: CampaignService,
    private readonly appEventBus: AppEventBus,
  ) {}

  /**
   * Executes one claimed discovery-run task.
   * @param task - Durable task row currently in the running state.
   */
  async execute(task: DBSchedulerTaskRowType): Promise<void> {
    const payload = JSON.parse(
      task.payload_json,
    ) as DiscoveryRunTaskPayloadType;

    const campaignId = task.campaign_id ?? undefined;

    await this.navigateToDiscoveryRun(payload);
    await assertAuthenticated(this.page, this.appEventBus);
    await this.scrapeAndPersistOrchestratorService.execute({
      ...payload,
      campaignId,
      isCancelled:
        campaignId === undefined
          ? undefined
          : () => this.campaignService.isCancelled(campaignId),
    });
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
            buildSearchURLParams(
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
