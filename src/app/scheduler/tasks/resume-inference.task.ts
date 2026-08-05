import { ResumeInferenceService } from "@/app/services/resume-inference.service.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import {
  DBSchedulerTaskRowType,
  ResumeInferenceTaskPayloadType,
} from "@/types/scheduler-task.type.js";

export class ResumeInferenceTask implements SchedulerTaskContract {
  readonly taskType = "resume_inference" as const;

  constructor(
    private readonly resumeInferenceService: ResumeInferenceService,
  ) {}

  async execute(task: DBSchedulerTaskRowType) {
    const payload = JSON.parse(
      task.payload_json,
    ) as ResumeInferenceTaskPayloadType;

    await this.resumeInferenceService.execute(payload.resume_id);
  }
}
