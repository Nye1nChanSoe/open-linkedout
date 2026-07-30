import type { CanonicalJobIdType } from "@/types/job-repository.type.js";

/**
 * Durable lifecycle states for a scheduler task.
 */
export type SchedulerTaskStatusType =
  /** Waiting for the scheduler to claim it. */
  | "pending"
  /** Claimed and currently being executed by a scheduler task. */
  | "running"
  /** Waiting until its next eligible retry time. */
  | "retry_wait"
  /** Finished successfully. */
  | "completed"
  /** Stopped after a non-retryable or final failure. */
  | "failed"
  /** Stopped intentionally and never run automatically. */
  | "cancelled";

export type SchedulerTaskType = "discovery_run" | "job_detail_scrape";

/** orchestrator.execute input requirements */
export type DiscoveryRunTaskPayloadType = {
  keyword: string;
  searchLocation: string;
  maxPages: number;
};

/** Canonical job whose LinkedIn detail page should be scraped. */
export type JobDetailScrapeTaskPayloadType = {
  job_id: CanonicalJobIdType;
};

export type CreateDiscoveryRunTaskInputType = DiscoveryRunTaskPayloadType;

export type DBSchedulerTaskRowType = {
  id: number;
  task_type: SchedulerTaskType;
  payload_json: string;
  status: SchedulerTaskStatusType;
  attempt_count: number;
  next_eligible_at: string | null;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type FindSchedulerTaskByIdParamsType = {
  id: number;
};

export type InsertSchedulerTaskParamsType = Omit<DBSchedulerTaskRowType, "id">;

export type ClaimNextEligibleTaskParamsType = {
  pending_status: SchedulerTaskStatusType;
  retry_wait_status: SchedulerTaskStatusType;
  running_status: SchedulerTaskStatusType;
  timestamp: string;
};

export type RecoverRunningTasksParamsType = {
  running_status: SchedulerTaskStatusType;
  pending_status: SchedulerTaskStatusType;
  updated_at: string;
};

export type MarkSchedulerTaskCompletedParamsType = {
  id: number;
  completed_status: SchedulerTaskStatusType;
  completed_at: string;
  updated_at: string;
};

export type MarkSchedulerTaskRetryWaitingParamsType = {
  id: number;
  retry_wait_status: SchedulerTaskStatusType;
  next_eligible_at: string;
  last_error: string;
  updated_at: string;
};

export type MarkSchedulerTaskFailedParamsType = {
  id: number;
  failed_status: SchedulerTaskStatusType;
  last_error: string;
  completed_at: string;
  updated_at: string;
};
