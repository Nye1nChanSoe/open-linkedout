import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";
import { ApplicationError } from "@/app/errors/application-error.js";
import { calculateExponentialBackoffDelay } from "@/app/retry/exponential-backoff.js";
import retryConfig from "@/config/retry.config.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import type {
  DBSchedulerTaskRowType,
  SchedulerTaskType,
} from "@/types/scheduler-task.type.js";

/**
 * Claims durable tasks and dispatches them to their matching task executors.
 */
export class Scheduler {
  private readonly taskTypes: SchedulerTaskType[];

  constructor(
    private readonly schedulerTaskRepository: SchedulerTaskRepository,
    private readonly taskExecutors: SchedulerTaskContract[],
  ) {
    this.taskTypes = taskExecutors.map((taskExecutor) => taskExecutor.taskType);
  }

  /**
   * Recovers tasks left running by a previous application process.
   * @returns Number of tasks returned to pending.
   */
  recoverInterruptedTasks(): number {
    return this.schedulerTaskRepository.recoverRunningTasks(this.taskTypes);
  }

  /**
   * Claims and executes one eligible durable task.
   * @returns Whether a task was claimed.
   */
  async run(): Promise<boolean> {
    const task = this.schedulerTaskRepository.claimNextEligibleTask(
      this.taskTypes,
    );

    if (!task) return false;

    try {
      const taskExecutor = this.findTaskExecutor(task);
      await taskExecutor.execute(task);
      this.schedulerTaskRepository.markCompleted(task.id);
    } catch (error) {
      this.handleTaskError(task, error);
    }

    return true;
  }

  /**
   * Finds the executor responsible for a claimed task.
   * @param task - Claimed durable task.
   * @returns Matching task executor.
   */
  private findTaskExecutor(
    task: DBSchedulerTaskRowType,
  ): SchedulerTaskContract {
    const taskExecutor = this.taskExecutors.find(
      (candidate) => candidate.taskType === task.task_type,
    );

    if (!taskExecutor)
      throw new Error(`No scheduler task executor for "${task.task_type}".`);

    return taskExecutor;
  }

  /**
   * Records a retryable task failure or final task failure.
   * @param task - Claimed task whose executor failed.
   * @param error - Task execution failure.
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
