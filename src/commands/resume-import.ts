import pc from "picocolors";

import { ResumeService } from "@/app/services/resume.service.js";
import { SchedulerTaskService } from "@/app/services/scheduler-task.service.js";
import { createDatabaseConnection } from "@database/connection.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";

const sourcePath = process.argv[2];

if (!sourcePath) {
  console.log(pc.yellow("Usage: npm run resume:import -- <resume-file-path>"));
  process.exit(1);
}

const database = createDatabaseConnection();

try {
  const resumeService = new ResumeService(
    new ResumeRepository(database),
    // TODO: currently passed schedulertaskservice directly for simplicity
    new SchedulerTaskService(new SchedulerTaskRepository(database)),
  );
  const result = await resumeService.execute({ sourcePath });

  console.info(
    result.wasImported
      ? pc.green("Imported resume")
      : pc.yellow("Resume exists"),
    pc.dim(":"),
    pc.cyan(result.resume.original_file_name),
    pc.dim("|"),
    pc.blue(`ID ${result.resume.id}`),
    pc.dim(`(${result.resume.file_size_bytes} bytes)`),
  );
} finally {
  database.close();
}
