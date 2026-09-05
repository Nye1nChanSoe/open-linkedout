import type { RestructExtractionResultType } from "@/types/resume-extraction.type.js";

export interface ResumeExtractorContract {
  /**
   * @returns Version string reported by the installed extractor.
   */
  readVersion(): Promise<string>;

  /**
   * @param filePath - Absolute path to the stored resume file.
   * @param outputPath - Absolute path the resume JSON is written to.
   * @returns Parsed document and the artifact it was read from.
   */
  extract(
    filePath: string,
    outputPath: string,
  ): Promise<RestructExtractionResultType>;
}
