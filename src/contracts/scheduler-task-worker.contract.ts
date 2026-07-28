import type {
  DBSchedulerTaskRowType,
  SchedulerTaskType,
} from "@/types/scheduler-task.type.js";

/** Executes one claimed scheduler task type. */
export type SchedulerTaskWorkerType = {
  taskType: SchedulerTaskType;

  /**
   * Executes one task claimed by the scheduler.
   * @param task - Durable task row currently in the running state.
   */
  execute(task: DBSchedulerTaskRowType): Promise<void>;
};
