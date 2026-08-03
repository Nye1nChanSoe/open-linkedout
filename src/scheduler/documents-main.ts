import pc from "picocolors";

import { DocxResumeExtractor } from "@/app/documents/docx-resume-extractor.js";
import { PdfResumeExtractor } from "@/app/documents/pdf-resume-extractor.js";
import { TextResumeExtractor } from "@/app/documents/text-resume-extractor.js";
import { Scheduler } from "@/app/scheduler/scheduler.js";
import { ResumeProcessTask } from "@/app/scheduler/tasks/resume-process.task.js";
import { ResumeProcessingService } from "@/app/services/resume-processing.service.js";
import { createDatabaseConnection } from "@database/connection.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";

const database = createDatabaseConnection();

try {
  const schedulerTaskRepository = new SchedulerTaskRepository(database);
  const resumeProcessingService = new ResumeProcessingService(
    new ResumeRepository(database),
    [
      new PdfResumeExtractor(),
      new DocxResumeExtractor(),
      new TextResumeExtractor(),
    ],
  );
  const scheduler = new Scheduler(schedulerTaskRepository, [
    new ResumeProcessTask(resumeProcessingService),
  ]);

  scheduler.recoverInterruptedTasks();
  while (await scheduler.run()) {}

  console.info(pc.green("Document scheduler finished."));
} finally {
  database.close();
}
