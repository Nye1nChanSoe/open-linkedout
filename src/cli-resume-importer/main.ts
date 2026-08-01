import pc from "picocolors";

import { ResumeService } from "@/app/services/resume.service.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { createDatabaseConnection } from "@database/connection.js";

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error("Usage: npm run resume:import -- <resume-file-path>");
}

const database = createDatabaseConnection();

try {
  const resumeService = new ResumeService(new ResumeRepository(database));
  const result = await resumeService.execute({ sourcePath });

  console.info(
    result.wasImported
      ? pc.green("Imported resume")
      : pc.yellow("Resume exists"),
    pc.dim(":"),
    pc.cyan(result.resume.original_file_name),
    pc.dim("|"),
    pc.blue(`resume ${result.resume.id}`),
    pc.dim("|"),
    pc.blue(`bytes ${result.resume.file_size_bytes}`),
  );
} finally {
  database.close();
}
