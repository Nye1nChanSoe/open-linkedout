import { ResumeProcessingService } from "@/app/services/resume-processing.service.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import type {
  DBSchedulerTaskRowType,
  ResumeProcessTaskPayloadType,
} from "@/types/scheduler-task.type.js";

export class ResumeProcessTask implements SchedulerTaskContract {
  readonly taskType = "resume_process" as const;

  constructor(
    private readonly resumeProcessingService: ResumeProcessingService,
  ) {}

  /**
   * @param task - Durable task row currently in the running state.
   */
  async execute(task: DBSchedulerTaskRowType) {
    const payload = JSON.parse(task.payload_json) as ResumeProcessTaskPayloadType;

    await this.resumeProcessingService.execute(payload.resume_id);
  }
}
