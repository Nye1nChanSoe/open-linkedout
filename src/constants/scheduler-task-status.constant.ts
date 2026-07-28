import type { SchedulerTaskStatusType } from "@/types/scheduler-task.type.js";

export const SCHEDULER_TASK_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  RETRY_WAIT: "retry_wait",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const satisfies Record<string, SchedulerTaskStatusType>;
