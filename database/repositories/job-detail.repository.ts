import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  DBJobDetailRowType,
  FindJobDetailByJobIdParamsType,
  FindJobDetailsByJobIdsParamsType,
  InsertJobDetailParamsType,
  JobDetailUpsertInputType,
  UpdateJobDetailParamsType,
} from "@/types/job-detail.type.js";

export class JobDetailRepository {
  private readonly findByJobIdStatement: BetterSqlite3.Statement<
    [FindJobDetailByJobIdParamsType],
    DBJobDetailRowType
  >;

  private readonly findManyByJobIdsStatement: BetterSqlite3.Statement<
    [FindJobDetailsByJobIdsParamsType],
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

    this.findManyByJobIdsStatement = database.prepare(
      `
      SELECT *
      FROM job_details
      WHERE job_id IN (SELECT value FROM json_each(@job_ids_json));
    `,
    );

    this.insertJobDetailStatement = database.prepare(
      `
      INSERT INTO job_details (
        job_id,
        header_text,
        description_text,
        description_html,
        source_url,
        external_apply_url,
        linkedin_show_match_details_ai_text,
        application_status,
        workplace_type,
        employment_type,
        applicant_count,
        is_applicant_count_capped,
        fetched_at,
        next_refresh_at,
        created_at,
        updated_at
      )
      VALUES (
        @job_id,
        @header_text,
        @description_text,
        @description_html,
        @source_url,
        @external_apply_url,
        @linkedin_show_match_details_ai_text,
        @application_status,
        @workplace_type,
        @employment_type,
        @applicant_count,
        @is_applicant_count_capped,
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
        /* A re-scrape that read no markup must not erase markup already held. */
        description_html = COALESCE(@description_html, description_html),
        source_url = @source_url,
        external_apply_url = @external_apply_url,
        linkedin_show_match_details_ai_text = @linkedin_show_match_details_ai_text,
        application_status = @application_status,
        workplace_type = @workplace_type,
        employment_type = @employment_type,
        applicant_count = @applicant_count,
        is_applicant_count_capped = @is_applicant_count_capped,
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
   * Finds the detail records for many canonical jobs at once.
   * @param jobIds - Internal canonical job identifiers.
   * @returns Detail records that exist, in no guaranteed order.
   */
  findManyByJobIds(jobIds: number[]) {
    if (!jobIds.length) return [];

    return this.findManyByJobIdsStatement.all({
      job_ids_json: JSON.stringify(jobIds),
    });
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
    const descriptionHtml = input.descriptionHtml ?? null;
    const headerFacts = input.headerFacts;
    const headerFactColumns = {
      workplace_type: headerFacts?.workplaceType ?? null,
      employment_type: headerFacts?.employmentType ?? null,
      applicant_count: headerFacts?.applicantCount ?? null,
      is_applicant_count_capped: headerFacts?.isApplicantCountCapped ? 1 : 0,
    };

    if (existingJobDetail) {
      this.updateJobDetailStatement.run({
        job_id: existingJobDetail.job_id,
        header_text: input.headerText,
        description_text: input.descriptionText,
        description_html: descriptionHtml,
        source_url: input.sourceUrl,
        external_apply_url: externalApplyUrl,
        linkedin_show_match_details_ai_text: linkedinShowMatchDetailsAiText,
        application_status: applicationStatus,
        ...headerFactColumns,
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
      description_html: descriptionHtml,
      source_url: input.sourceUrl,
      external_apply_url: externalApplyUrl,
      linkedin_show_match_details_ai_text: linkedinShowMatchDetailsAiText,
      application_status: applicationStatus,
      ...headerFactColumns,
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
