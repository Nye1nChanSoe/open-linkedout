import { JobStructureService } from "@/app/services/job-structure.service.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import type {
  DBSchedulerTaskRowType,
  JobStructureTaskPayloadType,
} from "@/types/scheduler-task.type.js";

/**
 * Parses ONE stored job description into sections.
 *
 * No browser and no network, which is why it runs on its own worker rather
 * than behind the scrape or document loops.
 */
export class JobStructureTask implements SchedulerTaskContract {
  readonly taskType = "job_structure" as const;

  constructor(private readonly jobStructureService: JobStructureService) {}

  /**
   * @param task - Durable task row currently in the running state.
   */
  async execute(task: DBSchedulerTaskRowType): Promise<void> {
    const payload = JSON.parse(
      task.payload_json,
    ) as JobStructureTaskPayloadType;

    this.jobStructureService.execute(payload.job_id);
  }
}
