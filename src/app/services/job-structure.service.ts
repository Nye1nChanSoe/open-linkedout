import { createHash } from "node:crypto";
import pc from "picocolors";

import { PersistenceError } from "@/app/errors/persistence-error.js";
import {
  JOB_STRUCTURE_PARSER_VERSION,
  JOB_STRUCTURE_SCHEMA_VERSION,
  parseJobStructure,
} from "@/app/parsers/job-detail-structure-parser.js";
import { SchedulerTaskService } from "@/app/services/scheduler-task.service.js";
import jobStructureConfig from "@/config/job-structure.config.js";
import type { CanonicalJobIdType } from "@/types/job-repository.type.js";
import type { JobStructureUpsertResultType } from "@/types/job-structure.type.js";
import { isDatabaseBusyError } from "@/utils/utils.js";
import { JobDetailRepository } from "@database/repositories/job-detail.repository.js";
import { JobStructureRepository } from "@database/repositories/job-structure.repository.js";
import { JobRepository } from "@database/repositories/job.repository.js";

/**
 * Parses ONE stored job description into sections and stores the result.
 */
export class JobStructureService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobDetailRepository: JobDetailRepository,
    private readonly jobStructureRepository: JobStructureRepository,
    private readonly schedulerTaskService: SchedulerTaskService,
  ) {}

  /**
   * Queues a parse for every job whose structure is missing or stale.
   * @returns Number of parse tasks queued.
   */
  queueOutdated(): number {
    const jobIds = this.jobStructureRepository.listJobIdsNeedingParse(
      JOB_STRUCTURE_PARSER_VERSION,
    );

    for (const jobId of jobIds) {
      this.schedulerTaskService.createJobStructureTask({ job_id: jobId });
    }

    console.info(
      pc.blueBright("Queued structure parsing:"),
      pc.cyan(`${jobIds.length} jobs`),
      pc.dim(`| parser ${JOB_STRUCTURE_PARSER_VERSION}`),
    );

    return jobIds.length;
  }

  /**
   * Parses and stores the structure for one canonical job.
   * @param jobId - Internal canonical job identifier.
   * @returns Persisted structure, or undefined when there was nothing to parse.
   */
  execute(jobId: CanonicalJobIdType): JobStructureUpsertResultType | undefined {
    const detail = this.jobDetailRepository.findByJobId(jobId);

    // A job whose detail page never rendered has no markup to parse. That is
    // an ordinary outcome, not a failure: closed jobs store no description.
    if (!detail?.description_html) {
      console.info(
        pc.yellow("Skipped structure"),
        pc.dim(":"),
        pc.cyan(`job ${jobId}`),
        pc.dim("| no description markup"),
      );

      return undefined;
    }

    const structure = parseJobStructure(
      detail.description_html,
      this.jobRepository.findById(jobId)?.title,
    );

    try {
      const result = this.jobStructureRepository.upsertJobStructure({
        jobId,
        structure,
        schemaVersion: JOB_STRUCTURE_SCHEMA_VERSION,
        parserVersion: JOB_STRUCTURE_PARSER_VERSION,
        sourceContentHash: hashSource(detail.description_html),
      });

      console.info(
        pc.blueBright("Structured job:"),
        pc.cyan(`job ${jobId}`),
        pc.dim("|"),
        pc.cyan(`${structure.sections.length} sections`),
        pc.dim(result.wasInserted ? "(new)" : "(reparsed)"),
      );

      return result;
    } catch (error) {
      const isDatabaseBusy = isDatabaseBusyError(error);

      throw new PersistenceError(
        `Failed to persist the job structure for canonical job ${jobId}.`,
        isDatabaseBusy ? "DATABASE_BUSY" : "DATABASE_ERROR",
        isDatabaseBusy,
        error,
      );
    }
  }
}

/**
 * @param descriptionHtml - Markup the structure was parsed from.
 * @returns Hash identifying that exact markup.
 */
function hashSource(descriptionHtml: string): string {
  return createHash(jobStructureConfig.HASH_FUNCTION)
    .update(descriptionHtml)
    .digest("hex");
}
