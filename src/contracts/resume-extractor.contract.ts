import type {
  ResumeExtractionResultType,
  ResumeSourceFormatType,
} from "@/types/resume.type.js";

export interface ResumeExtractorContract {
  readonly sourceFormat: ResumeSourceFormatType;

  /**
   * @param filePath - Absolute path to the stored resume file.
   * @returns Raw text and optional page count extracted from the file.
   */
  extract(filePath: string): Promise<ResumeExtractionResultType>;
}
