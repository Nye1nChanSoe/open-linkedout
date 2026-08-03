import mammoth from "mammoth";

import type { ResumeExtractorContract } from "@/contracts/resume-extractor.contract.js";

export class DocxResumeExtractor implements ResumeExtractorContract {
  readonly sourceFormat = "docx";

  /**
   * @param filePath - Absolute path to the stored DOCX resume.
   * @returns Raw text extracted from the DOCX file.
   */
  async extract(filePath: string) {
    const result = await mammoth.extractRawText({ path: filePath });

    return { rawText: result.value };
  }
}
