import pc from "picocolors";

import { RestructRunner } from "@/app/documents/restruct-runner.js";
import { Scheduler } from "@/app/scheduler/scheduler.js";
import { ResumeExtractTask } from "@/app/scheduler/tasks/resume-extract.task.js";
import { ResumeExtractionService } from "@/app/services/resume-extraction.service.js";
import restructConfig from "@/config/restruct.config.js";
import { sleep } from "@/utils/utils.js";
import { createDatabaseConnection } from "@database/connection.js";
import { ResumeExtractionRepository } from "@database/repositories/resume-extraction.repository.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";

const database = createDatabaseConnection();

try {
  const resumeExtractor = new RestructRunner();

  // Fails before any task is claimed. `--version` is answered before the
  // extractor loads its weights, so this costs nothing.
  const extractorVersion = await resumeExtractor.readVersion();

  if (extractorVersion !== restructConfig.PINNED_VERSION) {
    throw new Error(
      `Resume extractor ${extractorVersion} does not match the pinned ` +
        `${restructConfig.PINNED_VERSION}. Run \`npm run setup:extractor\`.`,
    );
  }

  const schedulerTaskRepository = new SchedulerTaskRepository(database);
  const resumeExtractionService = new ResumeExtractionService(
    new ResumeRepository(database),
    new ResumeExtractionRepository(database),
    resumeExtractor,
  );
  const scheduler = new Scheduler(schedulerTaskRepository, [
    new ResumeExtractTask(resumeExtractionService),
  ]);

  scheduler.recoverInterruptedTasks();
  console.info(
    pc.green("Document scheduler started."),
    pc.dim(":"),
    pc.cyan(`restruct ${extractorVersion}`),
  );

  while (true) {
    const wasTaskProcessed = await scheduler.run();

    // NOTE: can improve this further by making the worker sleep
    // until the nearest next_eligible_at time
    if (!wasTaskProcessed) {
      await sleep(1_000);
    }
  }
} finally {
  database.close();
}
