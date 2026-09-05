import {
  ImportResumeInputType,
  ImportResumeResultType,
} from "@/types/resume.type.js";
import config from "@config/resume.config.js";
import { SchedulerTaskService } from "@/app/services/scheduler-task.service.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

/**
 * NOTE: No MIME checks are made since this is supposed to be
 * running locally.
 */
export class ResumeService {
  constructor(
    private readonly resumeRepository: ResumeRepository,
    // TODO: move scheduler service to resume-orchestrator service later
    private readonly schedulerTaskService: SchedulerTaskService,
  ) {}

  /**
   * Stores a supported resume file
   * @param input - Path to the uploaded resume file.
   * @returns Existing or newly imported resume record.
   */
  async execute(input: ImportResumeInputType): Promise<ImportResumeResultType> {
    const fileName = basename(input.sourcePath);
    const fileExt = extname(fileName).toLocaleLowerCase();
    const format = config.SUPPORTED_RESUME_FORMATS[fileExt];

    if (!format) throw new Error("Resume must be PDF, DOCX, or Text file");

    const [fileStats, fileContent] = await Promise.all([
      stat(input.sourcePath),
      readFile(input.sourcePath),
    ]);

    // early exit if content hash doesn't change
    const contentHash = createHash(config.HASH_FUNCTION)
      .update(fileContent)
      .digest(config.HASH_DIGEST);
    const existingResume = this.resumeRepository.findByContentHash(contentHash);
    if (existingResume) return { resume: existingResume, wasImported: false };

    const internalFilename = `${contentHash}${fileExt}`;
    await mkdir(config.RESUME_DIR_PATH, { recursive: true });
    await copyFile(
      input.sourcePath,
      join(config.RESUME_DIR_PATH, internalFilename),
    );

    const resume = this.resumeRepository.createResume({
      fileName: internalFilename,
      originalFileName: fileName,
      contentHash,
      sourceFormat: format.format,
      fileSizeBytes: fileStats.size,
    });
    // TODO: move scheduler service to resume-orchestrator service later
    this.schedulerTaskService.createResumeExtractTask(resume.id);

    return { resume, wasImported: true };
  }
}
