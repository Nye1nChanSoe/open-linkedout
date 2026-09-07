import type { SchedulerTaskStatusType } from "@/types/scheduler-task.type.js";

/**
 * Lifecycle of one scraping campaign.
 *
 * A campaign is `completed` when no task of its own is left to run, and
 * `cancelled` the moment the user asks for it: claimed tasks stop at their
 * next cancellation check rather than being killed.
 */
export type CampaignStatusType =
  | "pending"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export type DBCampaignRowType = {
  id: number;
  name: string;
  keywords_json: string;
  locations_json: string;
  max_pages_per_combination: number;
  status: CampaignStatusType;
  cancel_requested_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type FindCampaignByIdParamsType = {
  id: number;
};

export type InsertCampaignParamsType = Omit<DBCampaignRowType, "id">;

export type UpdateCampaignStatusParamsType = {
  id: number;
  status: CampaignStatusType;
  cancel_requested_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type CreateCampaignInputType = {
  name: string;
  keywords: string[];
  locations: string[];
  maxPagesPerCombination: number;
};

/** One campaign with its keyword and location arrays already parsed. */
export type CampaignType = Omit<
  DBCampaignRowType,
  "keywords_json" | "locations_json" | "max_pages_per_combination"
> & {
  keywords: string[];
  locations: string[];
  maxPagesPerCombination: number;
};

/** Task counts for one campaign, grouped by durable task status. */
export type CampaignProgressType = {
  campaignId: number;
  totalTaskCount: number;
  countsByStatus: Record<SchedulerTaskStatusType, number>;
};

export type CampaignWithProgressType = CampaignType & {
  progress: CampaignProgressType;
};
