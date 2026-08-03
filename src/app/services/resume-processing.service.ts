import { join } from "node:path";

import config from "@/config/resume.config.js";
import type { ResumeExtractorContract } from "@/contracts/resume-extractor.contract.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";

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
    const resume = this.resumeRepository.findById(resumeId);

    if (!resume) throw new Error(`Resume ${resumeId} was not found.`);

    if (resume.processing_status !== "pending")
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

    this.resumeRepository.updateProcessingStatus(resume.id, "processing");

    try {
      const extraction = await extractor.extract(
        join(config.RESUME_DIR_PATH, resume.file_name),
      );

      const normalizedText = this.normalizeText(extraction.rawText);

      if (!this.hasUsableText(normalizedText)) {
        this.resumeRepository.updateProcessingStatus(resume.id, "needs_ocr");
      } else {
        this.resumeRepository.saveNativeExtraction(
          resume.id,
          extraction.rawText,
          normalizedText,
          extraction.pageCount,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.resumeRepository.updateProcessingStatus(
        resume.id,
        "failed",
        errorMessage,
      );

      throw error;
    }

    return this.resumeRepository.findById(resume.id)!;
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
}
