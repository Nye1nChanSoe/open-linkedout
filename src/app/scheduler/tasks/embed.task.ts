import { EmbeddingService } from "@/app/services/embedding.service.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";

/**
 * Embeds every chunk still missing a vector from the current profile.
 */
export class EmbedTask implements SchedulerTaskContract {
  readonly taskType = "embed" as const;

  constructor(private readonly embeddingService: EmbeddingService) {}

  async execute(): Promise<void> {
    await this.embeddingService.execute();
  }
}
