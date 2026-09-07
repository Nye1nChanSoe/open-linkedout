import { CampaignRepository } from "@database/repositories/campaign.repository.js";
import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";
import { AppEventBus } from "@/app/events/app-event-bus.js";
import { SchedulerTaskService } from "@/app/services/scheduler-task.service.js";
import type {
  CampaignProgressType,
  CampaignType,
  CampaignWithProgressType,
  CreateCampaignInputType,
  DBCampaignRowType,
} from "@/types/campaign.type.js";
import type { SchedulerTaskStatusType } from "@/types/scheduler-task.type.js";
import { runRepositoryOperationSafely } from "@/utils/utils.js";

const EMPTY_STATUS_COUNTS: Record<SchedulerTaskStatusType, number> = {
  pending: 0,
  running: 0,
  retry_wait: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
};

/**
 * Owns the campaign lifecycle: fan-out into discovery tasks, progress, and
 * cancellation.
 */
export class CampaignService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly schedulerTaskRepository: SchedulerTaskRepository,
    private readonly schedulerTaskService: SchedulerTaskService,
    private readonly appEventBus: AppEventBus,
  ) {}

  /**
   * Creates a campaign and queues one discovery run per keyword x location.
   * @param input - Keywords, locations and per-combination page limit.
   * @returns Created campaign with its initial progress.
   */
  createCampaign(input: CreateCampaignInputType): CampaignWithProgressType {
    if (!input.keywords.length || !input.locations.length) {
      throw new Error("A campaign needs at least one keyword and location.");
    }

    const campaign = runRepositoryOperationSafely("create campaign", () =>
      this.campaignRepository.createCampaign(input),
    );

    for (const keyword of input.keywords) {
      for (const searchLocation of input.locations) {
        this.schedulerTaskService.createDiscoveryRunTask({
          keyword,
          searchLocation,
          maxPages: input.maxPagesPerCombination,
          campaignId: campaign.id,
        });
      }
    }

    // Tasks exist from here on, so the campaign is running even though no
    // worker has claimed one yet.
    const runningCampaign = runRepositoryOperationSafely(
      `start campaign ${campaign.id}`,
      () => this.campaignRepository.markRunning(campaign.id),
    );

    this.appEventBus.publish({
      type: "campaign.status",
      campaignId: runningCampaign.id,
      status: runningCampaign.status,
    });

    return this.withProgress(runningCampaign);
  }

  /**
   * Lists every campaign with its task progress.
   * @returns All campaigns, newest first.
   */
  listCampaigns(): CampaignWithProgressType[] {
    return runRepositoryOperationSafely("list campaigns", () =>
      this.campaignRepository.list(),
    ).map((campaign) => this.withProgress(campaign));
  }

  /**
   * Finds one campaign with its task progress.
   * @param campaignId - Campaigns table identifier.
   * @returns Campaign with progress, if present.
   */
  findCampaign(campaignId: number): CampaignWithProgressType | undefined {
    const campaign = runRepositoryOperationSafely(
      `load campaign ${campaignId}`,
      () => this.campaignRepository.findById(campaignId),
    );

    return campaign ? this.withProgress(campaign) : undefined;
  }

  /**
   * Requests cancellation and empties the campaign's queue.
   * @param campaignId - Campaigns table identifier.
   * @returns Cancelled campaign with its final progress.
   */
  cancelCampaign(campaignId: number): CampaignWithProgressType {
    const campaign = runRepositoryOperationSafely(
      `cancel campaign ${campaignId}`,
      () => {
        this.schedulerTaskRepository.cancelPendingCampaignTasks(campaignId);

        return this.campaignRepository.requestCancellation(campaignId);
      },
    );

    this.appEventBus.publish({
      type: "campaign.status",
      campaignId: campaign.id,
      status: campaign.status,
    });

    return this.withProgress(campaign);
  }

  /**
   * Checks whether a campaign has been cancelled.
   * @param campaignId - Campaigns table identifier.
   * @returns Whether work for the campaign should stop.
   */
  isCancelled(campaignId: number): boolean {
    return runRepositoryOperationSafely(
      `read campaign ${campaignId} cancellation`,
      () => this.campaignRepository.isCancelled(campaignId),
    );
  }

  /**
   * Completes a running campaign once none of its tasks can still run.
   * @param campaignId - Campaigns table identifier.
   */
  completeWhenSettled(campaignId: number): void {
    const campaign = this.campaignRepository.findById(campaignId);

    if (!campaign || campaign.status !== "running") return;

    const progress = this.readProgress(campaignId);
    const activeTaskCount =
      progress.countsByStatus.pending +
      progress.countsByStatus.running +
      progress.countsByStatus.retry_wait;

    if (activeTaskCount > 0) return;

    // A campaign whose every task failed is a failed campaign, not a
    // finished one.
    const status =
      progress.countsByStatus.completed > 0 ? "completed" : "failed";
    const finishedCampaign = this.campaignRepository.markFinished(
      campaignId,
      status,
    );

    this.appEventBus.publish({
      type: "campaign.status",
      campaignId,
      status: finishedCampaign.status,
    });
  }

  private readProgress(campaignId: number): CampaignProgressType {
    const countsByStatus = { ...EMPTY_STATUS_COUNTS };

    for (const row of this.schedulerTaskRepository.countByStatus({
      campaignId,
    })) {
      countsByStatus[row.status] = row.total;
    }

    return {
      campaignId,
      totalTaskCount: Object.values(countsByStatus).reduce(
        (total, count) => total + count,
        0,
      ),
      countsByStatus,
    };
  }

  private withProgress(campaign: DBCampaignRowType): CampaignWithProgressType {
    return {
      ...toCampaign(campaign),
      progress: this.readProgress(campaign.id),
    };
  }
}

/**
 * Parses the JSON columns a campaign row stores its arrays in.
 * @param campaign - Raw campaign row.
 * @returns Campaign with parsed keywords and locations.
 */
export function toCampaign(campaign: DBCampaignRowType): CampaignType {
  const {
    keywords_json,
    locations_json,
    max_pages_per_combination,
    ...campaignFields
  } = campaign;

  return {
    ...campaignFields,
    keywords: JSON.parse(keywords_json) as string[],
    locations: JSON.parse(locations_json) as string[],
    maxPagesPerCombination: max_pages_per_combination,
  };
}
