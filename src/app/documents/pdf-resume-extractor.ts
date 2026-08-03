import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { ResumeExtractorContract } from "@/contracts/resume-extractor.contract.js";

export class PdfResumeExtractor implements ResumeExtractorContract {
  readonly sourceFormat = "pdf";

  /**
   * @param filePath - Absolute path to the stored PDF resume.
   * @returns Raw PDF text and its page count.
   */
  async extract(filePath: string) {
    const fileContent = new Uint8Array(await readFile(filePath));

    // pdfjs-dist -> document extraction
    const document = await getDocument({ data: fileContent }).promise;

    const pages = await Promise.all(
      Array.from({ length: document.numPages }, async (_, index) => {
        const page = await document.getPage(index + 1);
        const textContent = await page.getTextContent();

        /**
         * Example items: [{ str: "Software Engineer" }, { type: "beginMarkedContent" }]
         * Text fragments have `str`; non-text markers do not.
         */
        return textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
      }),
    );

    return {
      rawText: pages.join("\n\n"),
      pageCount: document.numPages,
    };
  }
}
