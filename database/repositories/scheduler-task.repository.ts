import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type { CanonicalJobIdType } from "@/types/job-repository.type.js";
import type {
  ClaimNextEligibleTaskParamsType,
  CreateDiscoveryRunTaskInputType,
  DBSchedulerTaskRowType,
  FindSchedulerTaskByIdParamsType,
  InsertSchedulerTaskParamsType,
  JobDetailScrapeTaskPayloadType,
  JobStructureTaskPayloadType,
  MarkSchedulerTaskCancelledParamsType,
  MarkSchedulerTaskCompletedParamsType,
  MarkSchedulerTaskFailedParamsType,
  MarkSchedulerTaskRetryWaitingParamsType,
  RecoverRunningTasksParamsType,
  ResumeExtractTaskPayloadType,
  SchedulerTaskListParamsType,
  SchedulerTaskStatusCountRowType,
  SchedulerTaskType,
} from "@/types/scheduler-task.type.js";

export class SchedulerTaskRepository {
  /**
   * Queue views are shaped by their filters, so their SQL cannot be
   * prepared once in the constructor.
   */
  private readonly listStatementCache = new Map<
    string,
    BetterSqlite3.Statement
  >();

  private readonly findByIdStatement: BetterSqlite3.Statement<
    [FindSchedulerTaskByIdParamsType],
    DBSchedulerTaskRowType
  >;

  private readonly insertTaskStatement: BetterSqlite3.Statement<
    [InsertSchedulerTaskParamsType]
  >;

  private readonly claimNextEligibleTaskStatement: BetterSqlite3.Statement<
    [ClaimNextEligibleTaskParamsType],
    DBSchedulerTaskRowType
  >;

  private readonly recoverRunningTasksStatement: BetterSqlite3.Statement<
    [RecoverRunningTasksParamsType]
  >;

  private readonly markCompletedStatement: BetterSqlite3.Statement<
    [MarkSchedulerTaskCompletedParamsType]
  >;

  private readonly markRetryWaitingStatement: BetterSqlite3.Statement<
    [MarkSchedulerTaskRetryWaitingParamsType]
  >;

  private readonly markFailedStatement: BetterSqlite3.Statement<
    [MarkSchedulerTaskFailedParamsType]
  >;

  private readonly markCancelledStatement: BetterSqlite3.Statement<
    [MarkSchedulerTaskCancelledParamsType]
  >;

  private readonly createJobDetailScrapeTasksTransaction: (
    jobIds: CanonicalJobIdType[],
    campaignId?: number,
  ) => DBSchedulerTaskRowType[];

  constructor(private readonly database: DatabaseConnectionType) {
    this.findByIdStatement = database.prepare(
      `
      SELECT *
      FROM scheduler_tasks
      WHERE id = @id;
    `,
    );

    this.insertTaskStatement = database.prepare(
      `
      INSERT INTO scheduler_tasks (
        task_type,
        payload_json,
        status,
        attempt_count,
        next_eligible_at,
        last_error,
        created_at,
        started_at,
        completed_at,
        updated_at,
        campaign_id
      )
      VALUES (
        @task_type,
        @payload_json,
        @status,
        @attempt_count,
        @next_eligible_at,
        @last_error,
        @created_at,
        @started_at,
        @completed_at,
        @updated_at,
        @campaign_id
      );
    `,
    );

    this.claimNextEligibleTaskStatement = database.prepare(
      `
      UPDATE scheduler_tasks
      SET
        status = @running_status,
        attempt_count = attempt_count + 1,
        started_at = COALESCE(started_at, @timestamp),
        updated_at = @timestamp
      WHERE id = (
        SELECT id
        FROM scheduler_tasks
        WHERE task_type IN (SELECT value FROM json_each(@task_types_json))
          AND (
            status = @pending_status
            OR (
              status = @retry_wait_status
              AND next_eligible_at <= @timestamp
            )
          )
        ORDER BY created_at
        LIMIT 1
      )
      RETURNING *;
    `,
    );

    this.recoverRunningTasksStatement = database.prepare(
      `
      UPDATE scheduler_tasks
      SET
        status = @pending_status,
        updated_at = @updated_at
      WHERE status = @running_status
        AND task_type IN (SELECT value FROM json_each(@task_types_json));
      `,
    );

    this.markCompletedStatement = database.prepare(
      `
      UPDATE scheduler_tasks
      SET
        status = @completed_status,
        next_eligible_at = NULL,
        last_error = NULL,
        completed_at = @completed_at,
        updated_at = @updated_at
      WHERE id = @id;
      `,
    );

    this.markRetryWaitingStatement = database.prepare(
      `
      UPDATE scheduler_tasks
      SET
        status = @retry_wait_status,
        next_eligible_at = @next_eligible_at,
        last_error = @last_error,
        updated_at = @updated_at
      WHERE id = @id;
      `,
    );

    this.markFailedStatement = database.prepare(
      `
      UPDATE scheduler_tasks
      SET
        status = @failed_status,
        next_eligible_at = NULL,
        last_error = @last_error,
        completed_at = @completed_at,
        updated_at = @updated_at
      WHERE id = @id;
      `,
    );

    this.markCancelledStatement = database.prepare(
      `
      UPDATE scheduler_tasks
      SET
        status = @cancelled_status,
        next_eligible_at = NULL,
        completed_at = @completed_at,
        updated_at = @updated_at
      WHERE id = @id;
      `,
    );

    this.createJobDetailScrapeTasksTransaction = database.transaction(
      (jobIds: CanonicalJobIdType[], campaignId?: number) =>
        jobIds.map((jobId) =>
          this.createJobDetailScrapeTask({ job_id: jobId }, campaignId),
        ),
    );
  }

  /**
   * Finds a durable scheduler task by its identifier.
   * @param id - Durable scheduler task identifier.
   * @returns Matching task, if present.
   */
  findById(id: number) {
    return this.findByIdStatement.get({ id });
  }

  /**
   * Creates one pending discovery-run task.
   * @param input - Search context and page limit for the discovery run.
   * @returns Newly created durable task.
   */
  createDiscoveryRunTask(input: CreateDiscoveryRunTaskInputType) {
    const timestamp = new Date().toISOString();
    // The campaign is a column, not payload: it is what cancellation and
    // progress queries filter on.
    const { campaignId, ...payload } = input;
    const task: InsertSchedulerTaskParamsType = {
      task_type: "discovery_run",
      payload_json: JSON.stringify(payload),
      status: "pending",
      attempt_count: 0,
      next_eligible_at: null,
      last_error: null,
      created_at: timestamp,
      started_at: null,
      completed_at: null,
      updated_at: timestamp,
      campaign_id: campaignId ?? null,
    };

    const result = this.insertTaskStatement.run(task);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Creates one pending job-detail scrape task.
   * @param input - Canonical job to scrape from LinkedIn's detail page.
   * @returns Newly created durable task.
   */
  createJobDetailScrapeTask(
    input: JobDetailScrapeTaskPayloadType,
    campaignId?: number,
  ) {
    const timestamp = new Date().toISOString();
    const task: InsertSchedulerTaskParamsType = {
      task_type: "job_detail_scrape",
      payload_json: JSON.stringify(input),
      status: "pending",
      attempt_count: 0,
      next_eligible_at: null,
      last_error: null,
      created_at: timestamp,
      started_at: null,
      completed_at: null,
      updated_at: timestamp,
      campaign_id: campaignId ?? null,
    };

    const result = this.insertTaskStatement.run(task);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Creates one pending job-structure task.
   *
   * campaign_id is deliberately left null: the markup is already paid for,
   * so cancelling a campaign must not discard structuring for jobs that were
   * already scraped.
   * @param input - Canonical job whose stored markup should be parsed.
   * @returns Newly created durable task.
   */
  createJobStructureTask(input: JobStructureTaskPayloadType) {
    const timestamp = new Date().toISOString();
    const task: InsertSchedulerTaskParamsType = {
      task_type: "job_structure",
      payload_json: JSON.stringify(input),
      status: "pending",
      attempt_count: 0,
      next_eligible_at: null,
      last_error: null,
      created_at: timestamp,
      started_at: null,
      completed_at: null,
      updated_at: timestamp,
      campaign_id: null,
    };

    const result = this.insertTaskStatement.run(task);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Creates one pending resume-extraction task.
   * @param input - Resume whose stored file should be extracted.
   * @returns Newly created durable task.
   */
  createResumeExtractTask(input: ResumeExtractTaskPayloadType) {
    const campaignId = undefined;
    const timestamp = new Date().toISOString();
    const task: InsertSchedulerTaskParamsType = {
      task_type: "resume_extract",
      payload_json: JSON.stringify(input),
      status: "pending",
      attempt_count: 0,
      next_eligible_at: null,
      last_error: null,
      created_at: timestamp,
      started_at: null,
      completed_at: null,
      updated_at: timestamp,
      campaign_id: campaignId ?? null,
    };

    const result = this.insertTaskStatement.run(task);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Creates pending job-detail scrape tasks in one transaction.
   * @param jobIds - Canonical jobs to scrape from LinkedIn detail pages.
   * @param campaignId - Campaign the discovery run belonged to, if any.
   * @returns Newly created durable tasks in the supplied job order.
   */
  createJobDetailScrapeTasks(
    jobIds: CanonicalJobIdType[],
    campaignId?: number,
  ) {
    return this.createJobDetailScrapeTasksTransaction(jobIds, campaignId);
  }

  /**
   * Atomically claims the oldest eligible task supported by this worker.
   * @param taskTypes - Task types the worker can execute.
   * @returns Claimed task, if one is eligible.
   */
  claimNextEligibleTask(taskTypes: SchedulerTaskType[]) {
    return this.claimNextEligibleTaskStatement.get({
      pending_status: "pending",
      retry_wait_status: "retry_wait",
      running_status: "running",
      task_types_json: JSON.stringify(taskTypes),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Returns supported tasks left running by a previous application process to pending.
   * @param taskTypes - Task types the worker can execute.
   * @returns Number of recovered tasks.
   */
  recoverRunningTasks(taskTypes: SchedulerTaskType[]) {
    const result = this.recoverRunningTasksStatement.run({
      running_status: "running",
      pending_status: "pending",
      task_types_json: JSON.stringify(taskTypes),
      updated_at: new Date().toISOString(),
    });

    return result.changes;
  }

  /**
   * Marks a task as completed.
   * @param id - Durable scheduler task identifier.
   */
  markCompleted(id: number) {
    const timestamp = new Date().toISOString();

    this.markCompletedStatement.run({
      id,
      completed_status: "completed",
      completed_at: timestamp,
      updated_at: timestamp,
    });
  }

  /**
   * Marks a task as waiting for a future retry.
   * @param id - Durable scheduler task identifier.
   * @param nextEligibleAt - Earliest time the task may run again.
   * @param lastError - Failure message from the latest attempt.
   */
  markRetryWaiting(
    id: number,
    nextEligibleAt: string,
    lastError: string,
  ) {
    this.markRetryWaitingStatement.run({
      id,
      retry_wait_status: "retry_wait",
      next_eligible_at: nextEligibleAt,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Marks a task as permanently failed.
   * @param id - Durable scheduler task identifier.
   * @param lastError - Failure message from the final attempt.
   */
  markFailed(id: number, lastError: string) {
    const timestamp = new Date().toISOString();

    this.markFailedStatement.run({
      id,
      failed_status: "failed",
      last_error: lastError,
      completed_at: timestamp,
      updated_at: timestamp,
    });
  }

  /**
   * Stops a task without running it again.
   * @param id - Durable scheduler task identifier.
   */
  markCancelled(id: number): void {
    const timestamp = new Date().toISOString();

    this.markCancelledStatement.run({
      id,
      cancelled_status: "cancelled",
      completed_at: timestamp,
      updated_at: timestamp,
    });
  }

  /**
   * Cancels every task of a campaign that has not started yet.
   *
   * A task already claimed is left alone: it stops itself at its next
   * cancellation check, which keeps its own row consistent.
   * @param campaignId - Campaign whose queue should be emptied.
   * @returns Number of cancelled tasks.
   */
  cancelPendingCampaignTasks(campaignId: number): number {
    const timestamp = new Date().toISOString();

    const statement = this.prepareCached(`
      UPDATE scheduler_tasks
      SET
        status = @cancelled_status,
        next_eligible_at = NULL,
        completed_at = @completed_at,
        updated_at = @updated_at
      WHERE campaign_id = @campaign_id
        AND status IN (@pending_status, @retry_wait_status);
    `);

    return statement.run({
      campaign_id: campaignId,
      cancelled_status: "cancelled",
      pending_status: "pending",
      retry_wait_status: "retry_wait",
      completed_at: timestamp,
      updated_at: timestamp,
    }).changes;
  }

  /**
   * Lists durable tasks for the queue view, newest first.
   * @param params - Paging and optional status, type and campaign filters.
   * @returns One page of durable tasks.
   */
  listByStatus(params: SchedulerTaskListParamsType): DBSchedulerTaskRowType[] {
    const { whereSql, filterParams } = buildTaskFilters(params);

    const statement = this.prepareCached(`
      SELECT *
      FROM scheduler_tasks
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT @limit OFFSET @offset;
    `);

    return statement.all({
      ...filterParams,
      limit: params.limit,
      offset: params.offset,
    }) as DBSchedulerTaskRowType[];
  }

  /**
   * Counts durable tasks grouped by status.
   * @param filters - Optional type and campaign filters.
   * @returns One count row per status present.
   */
  countByStatus(
    filters: Omit<SchedulerTaskListParamsType, "limit" | "offset"> = {},
  ): SchedulerTaskStatusCountRowType[] {
    const { whereSql, filterParams } = buildTaskFilters(filters);

    const statement = this.prepareCached(`
      SELECT status, COUNT(*) AS total
      FROM scheduler_tasks
      ${whereSql}
      GROUP BY status;
    `);

    return statement.all(filterParams) as SchedulerTaskStatusCountRowType[];
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
 * Translates queue filters into a WHERE clause and its named parameters.
 * @param filters - Optional status, type and campaign filters.
 * @returns SQL fragment and the parameters it binds.
 */
function buildTaskFilters(
  filters: Omit<SchedulerTaskListParamsType, "limit" | "offset">,
): {
  whereSql: string;
  filterParams: Record<string, string | number>;
} {
  const conditions: string[] = [];
  const filterParams: Record<string, string | number> = {};

  if (filters.statuses?.length) {
    conditions.push(
      "status IN (SELECT value FROM json_each(@statuses_json))",
    );
    filterParams.statuses_json = JSON.stringify(filters.statuses);
  }

  if (filters.taskTypes?.length) {
    conditions.push(
      "task_type IN (SELECT value FROM json_each(@task_types_json))",
    );
    filterParams.task_types_json = JSON.stringify(filters.taskTypes);
  }

  if (filters.campaignId !== undefined) {
    conditions.push("campaign_id = @campaign_id");
    filterParams.campaign_id = filters.campaignId;
  }

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    filterParams,
  };
}
