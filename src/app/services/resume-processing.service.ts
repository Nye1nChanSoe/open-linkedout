import { join } from "node:path";

import { PersistenceError } from "@/app/errors/persistence-error.js";
import config from "@/config/resume.config.js";
import type { ResumeExtractorContract } from "@/contracts/resume-extractor.contract.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { isDatabaseBusyError } from "@/utils/utils.js";

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
    const resume = this.executeRepositoryOperation(
      resumeId,
      "load resume",
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

    this.executeRepositoryOperation(resume.id, "mark resume processing", () =>
      this.resumeRepository.updateProcessingStatus(resume.id, "processing"),
    );

    try {
      const extraction = await extractor.extract(
        join(config.RESUME_DIR_PATH, resume.file_name),
      );

      const normalizedText = this.normalizeText(extraction.rawText);

      if (!this.hasUsableText(normalizedText)) {
        this.executeRepositoryOperation(resume.id, "mark resume needs OCR", () =>
          this.resumeRepository.updateProcessingStatus(resume.id, "needs_ocr"),
        );
      } else {
        this.executeRepositoryOperation(
          resume.id,
          "save native resume extraction",
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

      this.executeRepositoryOperation(
        resume.id,
        "mark resume failed",
        () =>
          this.resumeRepository.updateProcessingStatus(
            resume.id,
            "failed",
            errorMessage,
          ),
      );

      throw error;
    }

    return this.executeRepositoryOperation(
      resume.id,
      "load processed resume",
      () => this.resumeRepository.findById(resume.id)!,
    );
  }

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

  /**
   * @param resumeId - Resume database identifier.
   * @param operationName - Repository operation being executed.
   * @param operation - Synchronous repository operation.
   * @returns Repository operation result.
   */
  private executeRepositoryOperation<T>(
    resumeId: number,
    operationName: string,
    operation: () => T,
  ): T {
    try {
      return operation();
    } catch (error) {
      const isDatabaseBusy = isDatabaseBusyError(error);

      throw new PersistenceError(
        `Failed to ${operationName} for resume ${resumeId}.`,
        isDatabaseBusy ? "DATABASE_BUSY" : "DATABASE_ERROR",
        isDatabaseBusy,
        error,
      );
    }
  }
}
