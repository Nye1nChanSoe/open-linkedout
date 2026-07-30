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
  MarkSchedulerTaskCompletedParamsType,
  MarkSchedulerTaskFailedParamsType,
  MarkSchedulerTaskRetryWaitingParamsType,
  RecoverRunningTasksParamsType,
} from "@/types/scheduler-task.type.js";

export class SchedulerTaskRepository {
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

  private readonly createJobDetailScrapeTasksTransaction: (
    jobIds: CanonicalJobIdType[],
  ) => DBSchedulerTaskRowType[];

  constructor(private readonly database: DatabaseConnectionType) {
    this.findByIdStatement = database.prepare<
      FindSchedulerTaskByIdParamsType,
      DBSchedulerTaskRowType
    >(
      `
      SELECT *
      FROM scheduler_tasks
      WHERE id = @id;
    `,
    );

    this.insertTaskStatement = database.prepare<InsertSchedulerTaskParamsType>(
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
        updated_at
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
        @updated_at
      );
    `,
    );

    this.claimNextEligibleTaskStatement = database.prepare<
      ClaimNextEligibleTaskParamsType,
      DBSchedulerTaskRowType
    >(
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
        WHERE status = @pending_status
          OR (
            status = @retry_wait_status
            AND next_eligible_at <= @timestamp
          )
        ORDER BY created_at
        LIMIT 1
      )
      RETURNING *;
    `,
    );

    this.recoverRunningTasksStatement =
      database.prepare<RecoverRunningTasksParamsType>(
        `
      UPDATE scheduler_tasks
      SET
        status = @pending_status,
        updated_at = @updated_at
      WHERE status = @running_status;
    `,
      );

    this.markCompletedStatement =
      database.prepare<MarkSchedulerTaskCompletedParamsType>(
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

    this.markRetryWaitingStatement =
      database.prepare<MarkSchedulerTaskRetryWaitingParamsType>(
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

    this.markFailedStatement =
      database.prepare<MarkSchedulerTaskFailedParamsType>(
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

    this.createJobDetailScrapeTasksTransaction = database.transaction(
      (jobIds: CanonicalJobIdType[]) =>
        jobIds.map((jobId) => this.createJobDetailScrapeTask({ job_id: jobId })),
    );
  }

  /**
   * Finds a durable scheduler task by its identifier.
   * @param id - Durable scheduler task identifier.
   * @returns Matching task, if present.
   */
  findById(id: number): DBSchedulerTaskRowType | undefined {
    return this.findByIdStatement.get({ id });
  }

  /**
   * Creates one pending discovery-run task.
   * @param input - Search context and page limit for the discovery run.
   * @returns Newly created durable task.
   */
  createDiscoveryRunTask(
    input: CreateDiscoveryRunTaskInputType,
  ): DBSchedulerTaskRowType {
    const timestamp = new Date().toISOString();
    const task: InsertSchedulerTaskParamsType = {
      task_type: "discovery_run",
      payload_json: JSON.stringify(input),
      status: "pending",
      attempt_count: 0,
      next_eligible_at: null,
      last_error: null,
      created_at: timestamp,
      started_at: null,
      completed_at: null,
      updated_at: timestamp,
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
  ): DBSchedulerTaskRowType {
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
    };

    const result = this.insertTaskStatement.run(task);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Creates pending job-detail scrape tasks in one transaction.
   * @param jobIds - Canonical jobs to scrape from LinkedIn detail pages.
   * @returns Newly created durable tasks in the supplied job order.
   */
  createJobDetailScrapeTasks(
    jobIds: CanonicalJobIdType[],
  ): DBSchedulerTaskRowType[] {
    return this.createJobDetailScrapeTasksTransaction(jobIds);
  }

  /**
   * Atomically claims the oldest task currently eligible for execution.
   * @returns Claimed task, if one is eligible.
   */
  claimNextEligibleTask(): DBSchedulerTaskRowType | undefined {
    return this.claimNextEligibleTaskStatement.get({
      pending_status: "pending",
      retry_wait_status: "retry_wait",
      running_status: "running",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Returns tasks left running by a previous application process to pending.
   * @returns Number of recovered tasks.
   */
  recoverRunningTasks(): number {
    const result = this.recoverRunningTasksStatement.run({
      running_status: "running",
      pending_status: "pending",
      updated_at: new Date().toISOString(),
    });

    return result.changes;
  }

  /**
   * Marks a task as completed.
   * @param id - Durable scheduler task identifier.
   */
  markCompleted(id: number): void {
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
  ): void {
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
  markFailed(id: number, lastError: string): void {
    const timestamp = new Date().toISOString();

    this.markFailedStatement.run({
      id,
      failed_status: "failed",
      last_error: lastError,
      completed_at: timestamp,
      updated_at: timestamp,
    });
  }
}
