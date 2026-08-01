import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  DBJobDetailRowType,
  FindJobDetailByJobIdParamsType,
  InsertJobDetailParamsType,
  JobDetailUpsertInputType,
  UpdateJobDetailParamsType,
} from "@/types/job-detail.type.js";

export class JobDetailRepository {
  private readonly findByJobIdStatement: BetterSqlite3.Statement<
    [FindJobDetailByJobIdParamsType],
    DBJobDetailRowType
  >;

  private readonly insertJobDetailStatement: BetterSqlite3.Statement<
    [InsertJobDetailParamsType]
  >;

  private readonly updateJobDetailStatement: BetterSqlite3.Statement<
    [UpdateJobDetailParamsType]
  >;

  constructor(private readonly database: DatabaseConnectionType) {
    this.findByJobIdStatement = database.prepare(
      `
      SELECT *
      FROM job_details
      WHERE job_id = @job_id;
    `,
    );

    this.insertJobDetailStatement = database.prepare(
      `
      INSERT INTO job_details (
        job_id,
        header_text,
        description_text,
        source_url,
        external_apply_url,
        linkedin_show_match_details_ai_text,
        application_status,
        fetched_at,
        next_refresh_at,
        created_at,
        updated_at
      )
      VALUES (
        @job_id,
        @header_text,
        @description_text,
        @source_url,
        @external_apply_url,
        @linkedin_show_match_details_ai_text,
        @application_status,
        @fetched_at,
        @next_refresh_at,
        @created_at,
        @updated_at
      );
    `,
    );

    this.updateJobDetailStatement = database.prepare(
      `
      UPDATE job_details
      SET
        header_text = @header_text,
        description_text = @description_text,
        source_url = @source_url,
        external_apply_url = @external_apply_url,
        linkedin_show_match_details_ai_text = @linkedin_show_match_details_ai_text,
        application_status = @application_status,
        fetched_at = @fetched_at,
        next_refresh_at = @next_refresh_at,
        updated_at = @updated_at
      WHERE job_id = @job_id;
    `,
    );
  }

  /**
   * Finds the current detail record for a canonical job.
   * @param jobId - Internal canonical job identifier.
   * @returns Matching detail record, if present.
   */
  findByJobId(jobId: number) {
    return this.findByJobIdStatement.get({ job_id: jobId });
  }

  /**
   * Creates or refreshes a job's current detail-page record.
   * @param input - Latest raw data scraped from the job detail page.
   * @returns Persisted detail record and insert status.
   */
  upsertJobDetail(input: JobDetailUpsertInputType) {
    const existingJobDetail = this.findByJobId(input.jobId);
    const timestamp = new Date().toISOString();
    const applicationStatus = input.applicationStatus ?? "unknown";
    const nextRefreshAt = input.nextRefreshAt ?? null;
    const externalApplyUrl = input.externalApplyUrl ?? null;
    const linkedinShowMatchDetailsAiText =
      input.linkedinShowMatchDetailsAiText ?? null;

    if (existingJobDetail) {
      this.updateJobDetailStatement.run({
        job_id: existingJobDetail.job_id,
        header_text: input.headerText,
        description_text: input.descriptionText,
        source_url: input.sourceUrl,
        external_apply_url: externalApplyUrl,
        linkedin_show_match_details_ai_text: linkedinShowMatchDetailsAiText,
        application_status: applicationStatus,
        fetched_at: timestamp,
        next_refresh_at: nextRefreshAt,
        updated_at: timestamp,
      });

      return {
        jobDetail: this.findByJobId(existingJobDetail.job_id)!,
        wasInserted: false,
      };
    }

    this.insertJobDetailStatement.run({
      job_id: input.jobId,
      header_text: input.headerText,
      description_text: input.descriptionText,
      source_url: input.sourceUrl,
      external_apply_url: externalApplyUrl,
      linkedin_show_match_details_ai_text: linkedinShowMatchDetailsAiText,
      application_status: applicationStatus,
      fetched_at: timestamp,
      next_refresh_at: nextRefreshAt,
      created_at: timestamp,
      updated_at: timestamp,
    });

    return {
      jobDetail: this.findByJobId(input.jobId)!,
      wasInserted: true,
    };
  }
}
