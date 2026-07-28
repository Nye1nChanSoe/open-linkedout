import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";
import { ApplicationError } from "@/app/errors/application-error.js";
import { calculateExponentialBackoffDelay } from "@/app/retry/exponential-backoff.js";
import retryConfig from "@/config/retry.config.js";
import type { SchedulerTaskWorkerType } from "@/contracts/scheduler-task-worker.contract.js";
import type { DBSchedulerTaskRowType } from "@/types/scheduler-task.type.js";

/**
 * Claims durable tasks and dispatches them to their matching workers.
 */
export class Scheduler {
  /**
   * @param schedulerTaskRepository - Stores task lifecycle state.
   * @param workers - Workers available for supported scheduler task types.
   */
  constructor(
    private readonly schedulerTaskRepository: SchedulerTaskRepository,
    private readonly workers: SchedulerTaskWorkerType[],
  ) {}

  /**
   * Recovers tasks left running by a previous application process.
   * @returns Number of tasks returned to pending.
   */
  recoverInterruptedTasks(): number {
    return this.schedulerTaskRepository.recoverRunningTasks();
  }

  /**
   * Claims and executes one eligible durable task.
   * @returns Whether a task was claimed.
   */
  async run(): Promise<boolean> {
    const task = this.schedulerTaskRepository.claimNextEligibleTask();

    if (!task) return false;

    try {
      const worker = this.findWorker(task);
      await worker.execute(task);
      this.schedulerTaskRepository.markCompleted(task.id);
    } catch (error) {
      this.handleTaskError(task, error);
    }

    return true;
  }

  /**
   * Finds the worker responsible for a claimed task.
   * @param task - Claimed durable task.
   * @returns Matching task worker.
   */
  private findWorker(task: DBSchedulerTaskRowType): SchedulerTaskWorkerType {
    const worker = this.workers.find(
      (candidate) => candidate.taskType === task.task_type,
    );

    if (!worker)
      throw new Error(`No scheduler worker for task type "${task.task_type}".`);

    return worker;
  }

  /**
   * Records a retryable task failure or final task failure.
   * @param task - Claimed task whose worker failed.
   * @param error - Worker failure.
   */
  private handleTaskError(task: DBSchedulerTaskRowType, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof ApplicationError && error.retryable) {
      const delayMs = calculateExponentialBackoffDelay(
        task.attempt_count,
        retryConfig.BACKOFF,
      );
      const nextEligibleAt = new Date(Date.now() + delayMs).toISOString();

      this.schedulerTaskRepository.markRetryWaiting(
        task.id,
        nextEligibleAt,
        errorMessage,
      );
      return;
    }

    this.schedulerTaskRepository.markFailed(task.id, errorMessage);
  }
}
