import pc from "picocolors";

import { PersistenceError } from "@/app/errors/persistence-error.js";
import { isDatabaseBusyError } from "@/utils/utils.js";
import { JobDetailRepository } from "@database/repositories/job-detail.repository.js";
import type {
  PersistJobDetailInputType,
  PersistJobDetailResultType,
} from "@/types/persist-job-detail.type.js";

/**
 * Persists detailed data for ONE canonical job
 */
export class PersistJobDetailService {
  constructor(private readonly jobDetailRepository: JobDetailRepository) {}

  /**
   * @param input - Canonical job id and raw data extracted from its detail page.
   * @returns Persisted job detail record and insert status.
   */
  execute(input: PersistJobDetailInputType): PersistJobDetailResultType {
    try {
      const result = this.jobDetailRepository.upsertJobDetail({
        jobId: input.jobId,
        headerText: input.extractedJobDetail.headerText,
        descriptionText: input.extractedJobDetail.descriptionText,
        descriptionHtml: input.extractedJobDetail.descriptionHtml,
        sourceUrl: input.extractedJobDetail.sourceUrl,
        headerFacts: input.extractedJobDetail.headerFacts,
        linkedinShowMatchDetailsAiText:
          input.extractedJobDetail.linkedinShowMatchDetailsAiText,
        applicationStatus: input.extractedJobDetail.applicationStatus,
        externalApplyUrl: input.extractedJobDetail.externalApplyUrl,
      });

      console.info(
        pc.blueBright("Persisted job detail:"),
        pc.cyan(`job ${input.jobId}`),
        pc.dim("|"),
        pc.cyan(result.jobDetail.application_status),
        pc.dim(result.wasInserted ? "(new)" : "(updated)"),
      );

      return result;
    } catch (error) {
      const isDatabaseBusy = isDatabaseBusyError(error);

      throw new PersistenceError(
        `Failed to persist LinkedIn job detail for canonical job ${input.jobId}.`,
        isDatabaseBusy ? "DATABASE_BUSY" : "DATABASE_ERROR",
        isDatabaseBusy,
        error,
      );
    }
  }
}
