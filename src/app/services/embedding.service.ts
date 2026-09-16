import pc from "picocolors";

import { SchedulerTaskService } from "@/app/services/scheduler-task.service.js";
import config from "@/config/embedding.config.js";
import type { EmbeddingClientContract } from "@/contracts/embedding-client.contract.js";
import type { ChunkEmbeddingInputType } from "@/types/embedding.type.js";
import { runRepositoryOperationSafely } from "@/utils/utils.js";
import { ChunkEmbeddingRepository } from "@database/repositories/chunk-embedding.repository.js";

/**
 * Embeds every chunk that has no vector from the current profile.
 */
export class EmbeddingService {
  constructor(
    private readonly chunkEmbeddingRepository: ChunkEmbeddingRepository,
    private readonly embeddingClient: EmbeddingClientContract,
    private readonly schedulerTaskService: SchedulerTaskService,
  ) {}

  /**
   * Queues an embed task when any chunk lacks a current vector.
   * @returns Whether a task was queued.
   */
  queueOutdated(): boolean {
    const [pending] = runRepositoryOperationSafely(
      "check chunks needing embedding",
      () =>
        this.chunkEmbeddingRepository.listChunksNeedingEmbedding(
          this.embeddingClient.profileId,
          1,
        ),
    );
    const queued =
      pending !== undefined && this.schedulerTaskService.ensureEmbedTask();

    console.info(
      pc.blueBright("Queued embedding:"),
      pc.cyan(queued ? "1 task" : "0 tasks"),
      pc.dim(`| ${this.embeddingClient.profileId}`),
    );

    return queued;
  }

  /**
   * Embeds in rounds until no chunk is left, committing each round, so an
   * interrupted task keeps what it finished.
   */
  async execute(): Promise<void> {
    const { profileId } = this.embeddingClient;
    const orphans = runRepositoryOperationSafely("delete orphan vectors", () =>
      this.chunkEmbeddingRepository.deleteOrphanVectors(),
    );

    if (orphans > 0) {
      console.warn(
        pc.yellow("Removed orphan vectors:"),
        pc.cyan(`${orphans}`),
        pc.dim("| the chunk delete trigger missed them"),
      );
    }

    let embedded = 0;
    let reused = 0;

    for (;;) {
      const chunks = runRepositoryOperationSafely(
        "list chunks needing embedding",
        () =>
          this.chunkEmbeddingRepository.listChunksNeedingEmbedding(
            profileId,
            config.CHUNKS_PER_ROUND,
          ),
      );

      if (chunks.length === 0) break;

      const vectorsByHash = new Map<string, Float32Array>();
      const textsToEmbed = new Map<string, string>();

      for (const chunk of chunks) {
        if (
          vectorsByHash.has(chunk.text_hash) ||
          textsToEmbed.has(chunk.text_hash)
        ) {
          continue;
        }

        const stored = runRepositoryOperationSafely(
          "find reusable vector",
          () =>
            this.chunkEmbeddingRepository.findVectorByTextHash(
              chunk.text_hash,
              profileId,
            ),
        );

        if (stored) vectorsByHash.set(chunk.text_hash, stored);
        else textsToEmbed.set(chunk.text_hash, chunk.text);
      }

      const vectors = await this.embeddingClient.embedPassages([
        ...textsToEmbed.values(),
      ]);

      [...textsToEmbed.keys()].forEach((hash, index) =>
        vectorsByHash.set(hash, vectors[index]),
      );

      const rows: ChunkEmbeddingInputType[] = chunks.map((chunk) => ({
        chunkId: chunk.id,
        ownerKind: chunk.owner_kind,
        vector: vectorsByHash.get(chunk.text_hash)!,
      }));

      runRepositoryOperationSafely("store chunk vectors", () =>
        this.chunkEmbeddingRepository.upsertMany(rows, profileId),
      );

      embedded += textsToEmbed.size;
      reused += chunks.length - textsToEmbed.size;

      console.info(
        pc.blueBright("Embedded chunks:"),
        pc.cyan(`${embedded + reused} so far`),
        pc.dim(`| ${embedded} embedded, ${reused} reused`),
      );
    }
  }
}
