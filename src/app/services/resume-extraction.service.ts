import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";

import { ExtractionError } from "@/app/errors/extraction-error.js";
import { SchedulerTaskService } from "@/app/services/scheduler-task.service.js";
import restructConfig from "@/config/restruct.config.js";
import type { ResumeExtractorContract } from "@/contracts/resume-extractor.contract.js";
import { runRepositoryOperationSafely } from "@/utils/utils.js";
import { ResumeExtractionRepository } from "@database/repositories/resume-extraction.repository.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import resumeConfig from "@/config/resume.config.js";

/**
 * Extracts and persists the structured document for one imported resume.
 */
export class ResumeExtractionService {
  constructor(
    private readonly resumeRepository: ResumeRepository,
    private readonly resumeExtractionRepository: ResumeExtractionRepository,
    private readonly resumeExtractor: ResumeExtractorContract,
    private readonly schedulerTaskService: SchedulerTaskService,
  ) {}

  /**
   * Queues extraction for every resume whose extraction is missing or stale.
   * Uses the pinned version: the document worker refuses to run any other.
   * @returns Number of extraction tasks queued.
   */
  queueOutdated(): number {
    const resumeIds =
      this.resumeExtractionRepository.listResumeIdsNeedingExtraction(
        restructConfig.PINNED_VERSION,
      );

    for (const resumeId of resumeIds) {
      this.schedulerTaskService.createResumeExtractTask(resumeId);
    }

    console.info(
      pc.blueBright("Queued resume extraction:"),
      pc.cyan(`${resumeIds.length} resumes`),
      pc.dim(`| restruct ${restructConfig.PINNED_VERSION}`),
    );

    return resumeIds.length;
  }

  async execute(resumeId: number) {
    const resume = runRepositoryOperationSafely(`load resume ${resumeId}`, () =>
      this.resumeRepository.findById(resumeId),
    );

    if (!resume) throw new Error(`Resume ${resumeId} was not found.`);

    const extractorVersion = await this.resumeExtractor.readVersion();
    const existingExtraction = runRepositoryOperationSafely(
      `load extraction for resume ${resume.id}`,
      () => this.resumeExtractionRepository.findByResumeId(resume.id),
    );

    // Extraction is deterministic: the same bytes read by the same version
    // produce the same document, so there is nothing to redo.
    if (
      existingExtraction &&
      existingExtraction.source_content_hash === resume.content_hash &&
      existingExtraction.extractor_version === extractorVersion
    ) {
      return { resumeExtraction: existingExtraction, wasInserted: false };
    }

    runRepositoryOperationSafely(`mark resume ${resume.id} processing`, () =>
      this.resumeRepository.updateProcessingStatus(resume.id, "processing"),
    );

    try {
      await mkdir(restructConfig.EXTRACTIONS_DIR_PATH, { recursive: true });

      const extraction = await this.resumeExtractor.extract(
        join(resumeConfig.RESUME_DIR_PATH, resume.file_name),
        join(
          restructConfig.EXTRACTIONS_DIR_PATH,
          `${resume.content_hash}.json`,
        ),
      );

      const persistenceResult = runRepositoryOperationSafely(
        `save extraction for resume ${resume.id}`,
        () =>
          this.resumeExtractionRepository.upsertExtraction({
            resumeId: resume.id,
            document: extraction.document,
            extractorVersion,
            sourceContentHash: resume.content_hash,
            artifactPath: extraction.artifactPath,
          }),
      );

      runRepositoryOperationSafely(`mark resume ${resume.id} completed`, () =>
        this.resumeRepository.updateProcessingStatus(resume.id, "completed"),
      );

      this.schedulerTaskService.createChunkTask({
        owner_kind: "resume",
        owner_id: resume.id,
      });

      return persistenceResult;
    } catch (error) {
      this.recordFailure(resume.id, error);

      throw error;
    }
  }

  /**
   * Records a failure against the resume, unless the machine is at fault.
   * @param resumeId - Resume database identifier.
   * @param error - Failure raised while extracting or persisting.
   */
  private recordFailure(resumeId: number, error: unknown): void {
    // A missing extractor or missing weights says nothing about this resume,
    // and marking it failed would hide a perfectly readable file.
    if (
      !(error instanceof ExtractionError) ||
      error.code === "EXTRACTOR_UNAVAILABLE"
    ) {
      return;
    }

    const status =
      error.code === "EXTRACTOR_OCR_UNAVAILABLE" ? "needs_ocr" : "failed";

    runRepositoryOperationSafely(`mark resume ${resumeId} ${status}`, () =>
      this.resumeRepository.updateProcessingStatus(
        resumeId,
        status,
        error.message,
      ),
    );
  }
}
