import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  DBJobListRowType,
  FindJobByIdParamsType,
  FindJobByLinkedInJobIdParamsType,
  InsertJobParamsType,
  DBJobRowType,
  JobListFiltersType,
  JobListParamsType,
  JobUpsertInputType,
  UpdateJobParamsType,
} from "@/types/job-repository.type.js";
import { buildFtsMatchQuery } from "@/utils/utils.js";

export class JobRepository {
  /**
   * List queries are shaped by their filters, so their SQL cannot be
   * prepared once in the constructor. Each distinct shape is prepared on
   * first use and reused from here after.
   */
  private readonly listStatementCache = new Map<
    string,
    BetterSqlite3.Statement
  >();

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

  /**
   * Lists canonical jobs matching the supplied filters.
   * @param params - Paging, filters and sort order.
   * @returns One page of jobs with their detail status and discovery count.
   */
  list(params: JobListParamsType): DBJobListRowType[] {
    const { whereSql, filterParams } = buildJobFilters(params.filters);
    const sortField = params.sortField ?? "last_seen_at";
    const sortDirection = params.sortDirection === "asc" ? "ASC" : "DESC";

    const statement = this.prepareCached(`
      SELECT
        jobs.*,
        job_details.application_status AS application_status,
        (
          SELECT COUNT(*)
          FROM job_discoveries
          WHERE job_discoveries.job_id = jobs.id
        ) AS discovery_count
      FROM jobs
      LEFT JOIN job_details ON job_details.job_id = jobs.id
      ${whereSql}
      ORDER BY jobs.${sortField} ${sortDirection}, jobs.id DESC
      LIMIT @limit OFFSET @offset;
    `);

    return statement.all({
      ...filterParams,
      limit: params.limit,
      offset: params.offset,
    }) as DBJobListRowType[];
  }

  /**
   * Counts canonical jobs matching the supplied filters.
   * @param filters - Same filters accepted by `list`.
   * @returns Number of matching jobs.
   */
  count(filters?: JobListFiltersType): number {
    const { whereSql, filterParams } = buildJobFilters(filters);

    const statement = this.prepareCached(`
      SELECT COUNT(*) AS total
      FROM jobs
      LEFT JOIN job_details ON job_details.job_id = jobs.id
      ${whereSql};
    `);

    return (statement.get(filterParams) as { total: number }).total;
  }

  private prepareCached(sql: string): BetterSqlite3.Statement {
    const cachedStatement = this.listStatementCache.get(sql);

    if (cachedStatement) return cachedStatement;

    const statement = this.database.prepare(sql);
    this.listStatementCache.set(sql, statement);

    return statement;
  }
}

/**
 * Translates job filters into a WHERE clause and its named parameters.
 * @param filters - Optional job list filters.
 * @returns SQL fragment and the parameters it binds.
 */
function buildJobFilters(filters: JobListFiltersType = {}): {
  whereSql: string;
  filterParams: Record<string, string | number>;
} {
  const conditions: string[] = [];
  const filterParams: Record<string, string | number> = {};

  if (filters.company !== undefined) {
    conditions.push("jobs.company = @company");
    filterParams.company = filters.company;
  }

  if (filters.location !== undefined) {
    conditions.push("jobs.location LIKE @location");
    filterParams.location = `%${filters.location}%`;
  }

  if (filters.applicationStatus !== undefined) {
    conditions.push("job_details.application_status = @application_status");
    filterParams.application_status = filters.applicationStatus;
  }

  if (filters.hasDetail !== undefined) {
    conditions.push(
      filters.hasDetail
        ? "job_details.job_id IS NOT NULL"
        : "job_details.job_id IS NULL",
    );
  }

  if (filters.discoveryKeyword !== undefined) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM job_discoveries
        WHERE job_discoveries.job_id = jobs.id
          AND job_discoveries.keyword = @discovery_keyword
      )`);
    filterParams.discovery_keyword = filters.discoveryKeyword;
  }

  if (filters.campaignId !== undefined) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM job_discoveries
        WHERE job_discoveries.job_id = jobs.id
          AND job_discoveries.campaign_id = @campaign_id
      )`);
    filterParams.campaign_id = filters.campaignId;
  }

  if (filters.seenFrom !== undefined) {
    conditions.push("jobs.last_seen_at >= @seen_from");
    filterParams.seen_from = filters.seenFrom;
  }

  if (filters.seenTo !== undefined) {
    conditions.push("jobs.last_seen_at <= @seen_to");
    filterParams.seen_to = filters.seenTo;
  }

  // Lexical search only. Semantic search arrives with the embeddings.
  if (filters.searchText !== undefined) {
    conditions.push(`
      jobs.id IN (
        SELECT rowid
        FROM job_details_fts
        WHERE job_details_fts MATCH @search_text
      )`);
    filterParams.search_text = buildFtsMatchQuery(filters.searchText);
  }

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    filterParams,
  };
}
