import { createHash } from "node:crypto";

import pc from "picocolors";

import {
  chunkJobStructure,
  JOB_CHUNKER_VERSION,
} from "@/app/chunkers/job-chunker.js";
import {
  chunkResume,
  RESUME_CHUNKER_VERSION,
} from "@/app/chunkers/resume-chunker.js";
import { SchedulerTaskService } from "@/app/services/scheduler-task.service.js";
import chunkerConfig from "@/config/chunker.config.js";
import type {
  ChunkInputType,
  ChunkOwnerKindType,
  ChunkRowInputType,
  DBChunkRowType,
} from "@/types/chunk.type.js";
import type { JobStructureType } from "@/types/job-structure.type.js";
import type { RestructResumeTextType } from "@/types/resume-extraction.type.js";
import { runRepositoryOperationSafely } from "@/utils/utils.js";
import { ChunkRepository } from "@database/repositories/chunk.repository.js";
import { JobStructureRepository } from "@database/repositories/job-structure.repository.js";
import { ResumeExtractionRepository } from "@database/repositories/resume-extraction.repository.js";

const CHUNKER_VERSIONS: Record<ChunkOwnerKindType, string> = {
  job: JOB_CHUNKER_VERSION,
  resume: RESUME_CHUNKER_VERSION,
};

/**
 * Chunks ONE job structure or resume extraction and stores the chunks.
 */
export class ChunkService {
  constructor(
    private readonly chunkRepository: ChunkRepository,
    private readonly jobStructureRepository: JobStructureRepository,
    private readonly resumeExtractionRepository: ResumeExtractionRepository,
    private readonly schedulerTaskService: SchedulerTaskService,
  ) {}

  /**
   * Queues chunking for every document with no chunks from the current chunker.
   * @returns Number of chunk tasks queued.
   */
  queueOutdated(): number {
    let queued = 0;

    for (const ownerKind of ["job", "resume"] as const) {
      const ownerIds = runRepositoryOperationSafely(
        `list ${ownerKind}s needing chunking`,
        () =>
          this.chunkRepository.listOwnerIdsNeedingChunking(
            ownerKind,
            CHUNKER_VERSIONS[ownerKind],
          ),
      );

      for (const ownerId of ownerIds) {
        this.schedulerTaskService.createChunkTask({
          owner_kind: ownerKind,
          owner_id: ownerId,
        });
      }

      console.info(
        pc.blueBright("Queued chunking:"),
        pc.cyan(`${ownerIds.length} ${ownerKind}s`),
        pc.dim(`| ${ownerKind} chunker ${CHUNKER_VERSIONS[ownerKind]}`),
      );

      queued += ownerIds.length;
    }

    return queued;
  }

  /**
   * Chunks one document, replacing its chunks only when they changed.
   * Replacing deletes the old vectors, so an unchanged set is left alone.
   * @param ownerKind - Job or resume.
   * @param ownerId - Job or resume identifier.
   */
  execute(ownerKind: ChunkOwnerKindType, ownerId: number): void {
    const owner = { ownerKind, ownerId };
    const chunks = this.readChunks(ownerKind, ownerId);

    if (!chunks) {
      console.info(
        pc.yellow("Skipped chunking"),
        pc.dim(":"),
        pc.cyan(`${ownerKind} ${ownerId}`),
        pc.dim("| nothing parsed or extracted"),
      );

      return;
    }

    const createdAt = new Date().toISOString();
    const rows: ChunkRowInputType[] = chunks.map((chunk) => ({
      section: chunk.section,
      kind: chunk.kind,
      text: chunk.text,
      text_hash: createHash(chunkerConfig.HASH_FUNCTION)
        .update(chunk.text)
        .digest("hex"),
      source_path: chunk.sourcePath,
      chunker_version: CHUNKER_VERSIONS[ownerKind],
      created_at: createdAt,
    }));

    const existing = runRepositoryOperationSafely(
      `load chunks for ${ownerKind} ${ownerId}`,
      () => this.chunkRepository.listByOwner(owner),
    );

    if (isSameChunkSet(existing, rows)) {
      console.info(
        pc.blueBright("Chunks unchanged:"),
        pc.cyan(`${ownerKind} ${ownerId}`),
        pc.dim(`| ${rows.length} chunks`),
      );

      return;
    }

    const result = runRepositoryOperationSafely(
      `replace chunks for ${ownerKind} ${ownerId}`,
      () => this.chunkRepository.replaceForOwner(owner, rows),
    );

    console.info(
      pc.blueBright("Chunked:"),
      pc.cyan(`${ownerKind} ${ownerId}`),
      pc.dim("|"),
      pc.cyan(`${result.chunks.length} chunks`),
      pc.dim(`(${result.deletedCount} replaced)`),
    );

    this.schedulerTaskService.ensureEmbedTask();
  }

  private readChunks(
    ownerKind: ChunkOwnerKindType,
    ownerId: number,
  ): ChunkInputType[] | undefined {
    if (ownerKind === "job") {
      const row = runRepositoryOperationSafely(
        `load structure for job ${ownerId}`,
        () => this.jobStructureRepository.findByJobId(ownerId),
      );

      return (
        row &&
        chunkJobStructure(JSON.parse(row.structure_json) as JobStructureType)
      );
    }

    const row = runRepositoryOperationSafely(
      `load extraction for resume ${ownerId}`,
      () => this.resumeExtractionRepository.findByResumeId(ownerId),
    );

    return (
      row && chunkResume(JSON.parse(row.resume_json) as RestructResumeTextType)
    );
  }
}

function isSameChunkSet(
  existing: DBChunkRowType[],
  rows: ChunkRowInputType[],
): boolean {
  return (
    existing.length === rows.length &&
    existing.every(
      (chunk, index) =>
        chunk.source_path === rows[index].source_path &&
        chunk.text_hash === rows[index].text_hash &&
        chunk.section === rows[index].section &&
        chunk.kind === rows[index].kind &&
        chunk.chunker_version === rows[index].chunker_version,
    )
  );
}
