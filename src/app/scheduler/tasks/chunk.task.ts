import { ChunkService } from "@/app/services/chunk.service.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import type {
  ChunkTaskPayloadType,
  DBSchedulerTaskRowType,
} from "@/types/scheduler-task.type.js";

/**
 * Chunks ONE job structure or resume extraction.
 */
export class ChunkTask implements SchedulerTaskContract {
  readonly taskType = "chunk" as const;

  constructor(private readonly chunkService: ChunkService) {}

  /**
   * @param task - Durable task row currently in the running state.
   */
  async execute(task: DBSchedulerTaskRowType): Promise<void> {
    const payload = JSON.parse(task.payload_json) as ChunkTaskPayloadType;

    this.chunkService.execute(payload.owner_kind, payload.owner_id);
  }
}
