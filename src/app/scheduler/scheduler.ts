import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";
import { ApplicationError } from "@/app/errors/application-error.js";
import { AppEventBus } from "@/app/events/app-event-bus.js";
import { CampaignService } from "@/app/services/campaign.service.js";
import { calculateExponentialBackoffDelay } from "@/app/retry/exponential-backoff.js";
import { describeError } from "@/utils/utils.js";
import retryConfig from "@/config/retry.config.js";
import type { SchedulerTaskContract } from "@/contracts/scheduler-task.contract.js";
import type {
  DBSchedulerTaskRowType,
  SchedulerTaskStatusType,
  SchedulerTaskType,
} from "@/types/scheduler-task.type.js";

/**
 * Actually the naming is kinda misleading:
 *  - this should be the TaskDispatcher or TaskRunner
 *  - this class only knows about managing tasks (which tasks goes to which executor)
 *  - then mark it completed/retry/failed and check campaign settlement
 *
 * SchedulerWorker: is the long-running loop around the Scheduler
 * it keeps polling for queued work and repeatedly calls scheduler.run()
 */
export class Scheduler {
  private readonly taskTypes: SchedulerTaskType[];

  constructor(
    private readonly schedulerTaskRepository: SchedulerTaskRepository,
    private readonly taskExecutors: SchedulerTaskContract[],
    private readonly campaignService: CampaignService,
    private readonly appEventBus: AppEventBus,
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

    // Claimed before it could be cancelled in the queue, or cancelled while
    // it waited to retry. Either way it never runs.
    if (this.isCancelled(task)) {
      this.schedulerTaskRepository.markCancelled(task.id);
      this.publishFinished(task, "cancelled");
      this.settleCampaign(task);

      return true;
    }

    this.appEventBus.publish({
      type: "task.claimed",
      taskId: task.id,
      taskType: task.task_type,
      campaignId: task.campaign_id,
    });

    try {
      const taskExecutor = this.findTaskExecutor(task);
      await taskExecutor.execute(task);
      this.schedulerTaskRepository.markCompleted(task.id);
      this.publishFinished(task, "completed");
    } catch (error) {
      this.handleTaskError(task, error);
    }

    this.settleCampaign(task);

    return true;
  }

  /**
   * Checks whether a claimed task belongs to a cancelled campaign.
   * @param task - Claimed durable task.
   * @returns Whether the task should be abandoned.
   */
  private isCancelled(task: DBSchedulerTaskRowType): boolean {
    if (task.campaign_id === null) return false;

    return this.campaignService.isCancelled(task.campaign_id);
  }

  /**
   * Finishes the task's campaign once nothing of it is left to run.
   * @param task - Task that has just reached a status.
   */
  private settleCampaign(task: DBSchedulerTaskRowType): void {
    if (task.campaign_id === null) return;

    this.campaignService.completeWhenSettled(task.campaign_id);
  }

  private publishFinished(
    task: DBSchedulerTaskRowType,
    status: SchedulerTaskStatusType,
    error?: string,
  ): void {
    this.appEventBus.publish({
      type: "task.finished",
      taskId: task.id,
      taskType: task.task_type,
      campaignId: task.campaign_id,
      status,
      error,
    });
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
    // The classified message alone hides what happened; the cause goes with it.
    const errorMessage = describeError(error);

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
      this.publishFinished(task, "retry_wait", errorMessage);
      return;
    }

    this.schedulerTaskRepository.markFailed(task.id, errorMessage);
    this.publishFinished(task, "failed", errorMessage);
  }
}
