import pc from "picocolors";

import { Scheduler } from "@/app/scheduler/scheduler.js";
import type { SchedulerTaskType } from "@/types/scheduler-task.type.js";
import { sleep } from "@/utils/utils.js";
import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";

/**
 * Runs one scheduler loop for a set of task types.
 *
 * The scheduler is built through a factory and only when work exists, which
 * is what keeps the browser closed until a scrape task is actually queued.
 */
export class SchedulerWorker {
  private scheduler?: Scheduler;
  private isStopping = false;

  constructor(
    private readonly name: string,
    private readonly taskTypes: SchedulerTaskType[],
    private readonly schedulerTaskRepository: SchedulerTaskRepository,
    private readonly createScheduler: () => Promise<Scheduler>,
    private readonly idlePollIntervalMs: number,
  ) {}

  /**
   * Recovers interrupted tasks and processes work until stopped.
   */
  async start(): Promise<void> {
    // Tasks left running by a killed process are invisible to the queue
    // check below until they are back in pending.
    const recoveredTaskCount = this.schedulerTaskRepository.recoverRunningTasks(
      this.taskTypes,
    );

    if (recoveredTaskCount > 0) {
      console.info(
        pc.yellow(`${this.name}: recovered`),
        pc.cyan(`${recoveredTaskCount} interrupted tasks`),
      );
    }

    while (!this.isStopping) {
      if (!this.hasQueuedWork()) {
        await sleep(this.idlePollIntervalMs);
        continue;
      }

      const scheduler = (this.scheduler ??= await this.createScheduler());

      while (!this.isStopping && (await scheduler.run())) {}

      // Retry-waiting tasks are queued but not yet eligible.
      await sleep(this.idlePollIntervalMs);
    }
  }

  /** Stops the loop after the task in flight finishes. */
  stop(): void {
    this.isStopping = true;
  }

  private hasQueuedWork(): boolean {
    return this.schedulerTaskRepository
      .countByStatus({
        taskTypes: this.taskTypes,
        statuses: ["pending", "retry_wait"],
      })
      .some((row) => row.total > 0);
  }
}
