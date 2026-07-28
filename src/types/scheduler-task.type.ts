/**
 * Durable lifecycle states for a scheduler task.
 */
export type SchedulerTaskStatusType =
  /** Waiting for the scheduler to claim it. */
  | "pending"
  /** Claimed and currently being executed by a worker. */
  | "running"
  /** Waiting until its next eligible retry time. */
  | "retry_wait"
  /** Finished successfully. */
  | "completed"
  /** Stopped after a non-retryable or final failure. */
  | "failed"
  /** Stopped intentionally and never run automatically. */
  | "cancelled";

// currently support only one scheduler task type
export type SchedulerTaskType = "discovery_run";

/** orchestrator.execute input requirements */
export type DiscoveryRunTaskPayloadType = {
  keyword: string;
  searchLocation: string;
  maxPages: number;
};

/** Serialized task-specific payload stored by the scheduler. */
export type SchedulerTaskPayloadType = DiscoveryRunTaskPayloadType;

/** Input used to create one pending discovery-run task. */
export type CreateDiscoveryRunTaskInputType = DiscoveryRunTaskPayloadType;

export type DBSchedulerTaskRowType = {
  id: string;
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
  id: string;
};

export type InsertSchedulerTaskParamsType = DBSchedulerTaskRowType;

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
  id: string;
  completed_status: SchedulerTaskStatusType;
  completed_at: string;
  updated_at: string;
};

export type MarkSchedulerTaskRetryWaitingParamsType = {
  id: string;
  retry_wait_status: SchedulerTaskStatusType;
  next_eligible_at: string;
  last_error: string;
  updated_at: string;
};

export type MarkSchedulerTaskFailedParamsType = {
  id: string;
  failed_status: SchedulerTaskStatusType;
  last_error: string;
  completed_at: string;
  updated_at: string;
};
