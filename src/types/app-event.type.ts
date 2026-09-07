import type { CampaignStatusType } from "@/types/campaign.type.js";
import type {
  SchedulerTaskStatusType,
  SchedulerTaskType,
} from "@/types/scheduler-task.type.js";

/**
 * Everything the UI learns about while it is open.
 *
 * The whole application runs in one process, so these are published in
 * memory and streamed to the browser over SSE. Nothing polls.
 */
export type AppEventType =
  | {
      type: "task.claimed";
      taskId: number;
      taskType: SchedulerTaskType;
      campaignId: number | null;
    }
  | {
      type: "task.finished";
      taskId: number;
      taskType: SchedulerTaskType;
      campaignId: number | null;
      status: SchedulerTaskStatusType;
      error?: string;
    }
  | {
      type: "campaign.status";
      campaignId: number;
      status: CampaignStatusType;
    }
  | {
      type: "discovery.page";
      campaignId: number | null;
      keyword: string;
      searchLocation: string;
      pageNumber: number;
      insertedJobCount: number;
      updatedJobCount: number;
    }
  /**
   * LinkedIn is asking for a sign-in. Scraping cannot continue unattended,
   * so this is a first-class state the UI shows rather than an error.
   */
  | {
      type: "linkedin.authentication_required";
      url: string;
    };

/** One published event, stamped as it leaves the emitter. */
export type PublishedAppEventType = AppEventType & {
  emittedAt: string;
};

export type AppEventListenerType = (event: PublishedAppEventType) => void;
