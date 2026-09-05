import { ResumeExtractionService } from "@/app/services/resume-extraction.service.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import type {
  DBSchedulerTaskRowType,
  ResumeExtractTaskPayloadType,
} from "@/types/scheduler-task.type.js";

export class ResumeExtractTask implements SchedulerTaskContract {
  readonly taskType = "resume_extract" as const;

  constructor(
    private readonly resumeExtractionService: ResumeExtractionService,
  ) {}

  /**
   * @param task - Durable task row currently in the running state.
   */
  async execute(task: DBSchedulerTaskRowType) {
    const payload = JSON.parse(
      task.payload_json,
    ) as ResumeExtractTaskPayloadType;

    await this.resumeExtractionService.execute(payload.resume_id);
  }
}
