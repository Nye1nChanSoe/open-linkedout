import { join } from "node:path";

import { PersistenceError } from "@/app/errors/persistence-error.js";
import config from "@/config/resume.config.js";
import type { ResumeExtractorContract } from "@/contracts/resume-extractor.contract.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { runRepositoryOperationSafely } from "@/utils/utils.js";

export class ResumeProcessingService {
  constructor(
    private readonly resumeRepository: ResumeRepository,
    private readonly resumeExtractors: ResumeExtractorContract[],
  ) {}

  /**
   * Extracts and persists native text for one pending resume.
   * @param resumeId - Resume database identifier.
   * @returns Processed resume record.
  */
  async execute(resumeId: number) {
    const resume = runRepositoryOperationSafely(
      `load resume ${resumeId}`,
      () => this.resumeRepository.findById(resumeId),
    );

    if (!resume) throw new Error(`Resume ${resumeId} was not found.`);

    if (
      resume.processing_status === "completed" ||
      resume.processing_status === "needs_ocr"
    ) {
      return resume;
    }

    if (
      resume.processing_status !== "pending" &&
      resume.processing_status !== "processing"
    )
      throw new Error(
        `Resume ${resumeId} cannot be processed from ${resume.processing_status}.`,
      );

    const extractor = this.resumeExtractors.find(
      (candidate) => candidate.sourceFormat === resume.source_format,
    );

    if (!extractor)
      throw new Error(
        `No extractor is configured for ${resume.source_format} resumes.`,
      );

    runRepositoryOperationSafely(`mark resume ${resume.id} processing`, () =>
      this.resumeRepository.updateProcessingStatus(resume.id, "processing"),
    );

    try {
      const extraction = await extractor.extract(
        join(config.RESUME_DIR_PATH, resume.file_name),
      );

      const normalizedText = this.normalizeText(extraction.rawText);

      if (!this.hasUsableText(normalizedText)) {
        runRepositoryOperationSafely(`mark resume ${resume.id} needs OCR`, () =>
          this.resumeRepository.updateProcessingStatus(resume.id, "needs_ocr"),
        );
      } else {
        runRepositoryOperationSafely(
          `save native extraction for resume ${resume.id}`,
          () =>
            this.resumeRepository.saveNativeExtraction(
              resume.id,
              extraction.rawText,
              normalizedText,
              extraction.pageCount,
            ),
        );
      }
    } catch (error) {
      if (error instanceof PersistenceError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      runRepositoryOperationSafely(
        `mark resume ${resume.id} failed`,
        () =>
          this.resumeRepository.updateProcessingStatus(
            resume.id,
            "failed",
            errorMessage,
          ),
      );

      throw error;
    }

    return runRepositoryOperationSafely(
      `load processed resume ${resume.id}`,
      () => this.resumeRepository.findById(resume.id)!,
    );
  }

  // TODO: Preserve document headings and paragraph boundaries for richer semantic parsing.
  // V1 only normalizes whitespace before LLM inference.
  private normalizeText(rawText: string) {
    return rawText
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[\t\f\v ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private hasUsableText(normalizedText: string) {
    return normalizedText.length > 0;
  }

}
