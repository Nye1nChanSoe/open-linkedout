import pc from "picocolors";

import { DocxResumeExtractor } from "@/app/documents/docx-resume-extractor.js";
import { PdfResumeExtractor } from "@/app/documents/pdf-resume-extractor.js";
import { TextResumeExtractor } from "@/app/documents/text-resume-extractor.js";
import { ResumeProcessingService } from "@/app/services/resume-processing.service.js";
import { createDatabaseConnection } from "@database/connection.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";

const resumeId = Number(process.argv[2]);

if (!Number.isInteger(resumeId) || resumeId <= 0) {
  console.log(pc.yellow("Usage: npm run resume:process -- <resume-id>"));
  process.exit(1);
}

const database = createDatabaseConnection();

try {
  const resumeProcessingService = new ResumeProcessingService(
    new ResumeRepository(database),
    [
      new PdfResumeExtractor(),
      new DocxResumeExtractor(),
      new TextResumeExtractor(),
    ],
  );
  const resume = await resumeProcessingService.execute(resumeId);

  console.info(
    pc.green("Processed resume"),
    pc.dim(":"),
    pc.cyan(resume.original_file_name),
    pc.dim("|"),
    pc.blue(`ID ${resume.id}`),
    pc.dim("|"),
    pc.cyan(resume.processing_status),
  );
} finally {
  database.close();
}
