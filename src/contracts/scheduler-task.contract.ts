import type {
  DBSchedulerTaskRowType,
  SchedulerTaskType,
} from "@/types/scheduler-task.type.js";

export interface SchedulerTaskContract {
  readonly taskType: SchedulerTaskType;
  execute(task: DBSchedulerTaskRowType): Promise<void>;
}
