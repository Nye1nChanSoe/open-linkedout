import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  FindJobByIdParamsType,
  FindJobByLinkedInJobIdParamsType,
  InsertJobParamsType,
  DBJobRowType,
  JobUpsertInputType,
  UpdateJobParamsType,
} from "@/types/job-repository.type.js";

export class JobRepository {
  private readonly findByLinkedInJobIdStatement: BetterSqlite3.Statement<
    [FindJobByLinkedInJobIdParamsType],
    DBJobRowType
  >;

  private readonly findByIdStatement: BetterSqlite3.Statement<
    [FindJobByIdParamsType],
    DBJobRowType
  >;

  private readonly insertJobStatement: BetterSqlite3.Statement<
    [InsertJobParamsType]
  >;

  private readonly updateJobStatement: BetterSqlite3.Statement<
    [UpdateJobParamsType]
  >;

  constructor(private readonly database: DatabaseConnectionType) {
    this.findByLinkedInJobIdStatement = database.prepare(
      `
      SELECT *
      FROM jobs
      WHERE linkedin_job_id = @linkedin_job_id;
    `,
    );

    this.findByIdStatement = database.prepare(
      `
      SELECT *
      FROM jobs
      WHERE id = @id;
    `,
    );

    this.insertJobStatement = database.prepare(
      `
      INSERT INTO jobs (
        linkedin_job_id,
        title,
        company,
        location,
        canonical_url,
        logo_image_url,
        posted_date,
        posted_ago,
        salary_text,
        insights_json,
        is_viewed,
        is_easy_apply,
        is_early_applicant,
        first_seen_at,
        last_seen_at,
        created_at,
        updated_at
      )
      VALUES (
        @linkedin_job_id,
        @title,
        @company,
        @location,
        @canonical_url,
        @logo_image_url,
        @posted_date,
        @posted_ago,
        @salary_text,
        @insights_json,
        @is_viewed,
        @is_easy_apply,
        @is_early_applicant,
        @first_seen_at,
        @last_seen_at,
        @created_at,
        @updated_at
      );
    `,
    );

    this.updateJobStatement = database.prepare(
      `
      UPDATE jobs
      SET
        title = @title,
        company = @company,
        location = @location,
        canonical_url = @canonical_url,
        logo_image_url = @logo_image_url,
        posted_date = @posted_date,
        posted_ago = @posted_ago,
        salary_text = @salary_text,
        insights_json = @insights_json,
        is_viewed = @is_viewed,
        is_easy_apply = @is_easy_apply,
        is_early_applicant = @is_early_applicant,
        last_seen_at = @last_seen_at,
        updated_at = @updated_at
      WHERE id = @id;
    `,
    );
  }

  /**
   * Finds a canonical job by its LinkedIn job identifier.
   * @param linkedinJobId - LinkedIn's external job identifier.
   * @returns Matching canonical job, if present.
   */
  findByLinkedInJobId(linkedinJobId: string) {
    return this.findByLinkedInJobIdStatement.get({
      linkedin_job_id: linkedinJobId,
    });
  }

  /**
   * Finds a canonical job by its database identifier.
   * @param id - Canonical jobs table identifier.
   * @returns Matching canonical job, if present.
   */
  findById(id: number) {
    return this.findByIdStatement.get({ id });
  }

  /**
   * Creates or refreshes a canonical job.
   * @param input - Latest scraped job-card data.
   * @returns Persisted canonical job and insert status.
   */
  upsertJob(input: JobUpsertInputType) {
    const existingJob = this.findByLinkedInJobId(input.linkedinJobId);
    const timestamp = new Date().toISOString();

    if (existingJob) {
      this.updateJobStatement.run({
        id: existingJob.id,
        title: input.title,
        company: input.company ?? null,
        location: input.location ?? null,
        canonical_url: input.canonicalUrl,
        logo_image_url: input.logoImageUrl ?? null,
        posted_date: input.postedDate ?? null,
        posted_ago: input.postedAgo ?? null,
        salary_text: input.salaryText ?? null,
        insights_json: input.insights ? JSON.stringify(input.insights) : null,
        is_viewed: Number(input.isViewed),
        is_easy_apply: Number(input.isEasyApply),
        is_early_applicant: Number(input.isEarlyApplicant),
        last_seen_at: timestamp,
        updated_at: timestamp,
      });

      return {
        job: this.findById(existingJob.id)!,
        wasInserted: false,
      };
    }

    const insertParams: InsertJobParamsType = {
      linkedin_job_id: input.linkedinJobId,
      title: input.title,
      company: input.company ?? null,
      location: input.location ?? null,
      canonical_url: input.canonicalUrl,
      logo_image_url: input.logoImageUrl ?? null,
      posted_date: input.postedDate ?? null,
      posted_ago: input.postedAgo ?? null,
      salary_text: input.salaryText ?? null,
      insights_json: input.insights ? JSON.stringify(input.insights) : null,
      is_viewed: Number(input.isViewed),
      is_easy_apply: Number(input.isEasyApply),
      is_early_applicant: Number(input.isEarlyApplicant),
      first_seen_at: timestamp,
      last_seen_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const result = this.insertJobStatement.run(insertParams);

    return {
      job: this.findById(Number(result.lastInsertRowid))!,
      wasInserted: true,
    };
  }
}
