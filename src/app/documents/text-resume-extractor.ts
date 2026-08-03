import { readFile } from "node:fs/promises";

import type { ResumeExtractorContract } from "@/contracts/resume-extractor.contract.js";

export class TextResumeExtractor implements ResumeExtractorContract {
  readonly sourceFormat = "txt";

  /**
   * @param filePath - Absolute path to the stored text resume.
   * @returns Raw text read from the file.
   */
  async extract(filePath: string) {
    return { rawText: await readFile(filePath, "utf8") };
  }
}
