import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";
import { PersistenceError } from "@/app/errors/persistence-error.js";
import type { CanonicalJobIdType } from "@/types/job-repository.type.js";
import type {
  CreateDiscoveryRunTaskInputType,
  DBSchedulerTaskRowType,
} from "@/types/scheduler-task.type.js";
import { isDatabaseBusyError } from "@/utils/utils.js";

/**
 * Creates durable scheduler tasks for application workflows.
 */
export class SchedulerTaskService {
  constructor(
    private readonly schedulerTaskRepository: SchedulerTaskRepository,
  ) {}

  /**
   * Creates one pending LinkedIn discovery-run task.
   * @param input - Search context and page limit for the discovery run.
   * @returns Newly created durable scheduler task.
   */
  createDiscoveryRunTask(
    input: CreateDiscoveryRunTaskInputType,
  ): DBSchedulerTaskRowType {
    return this.schedulerTaskRepository.createDiscoveryRunTask(input);
  }

  /**
   * Creates one pending job-detail scrape task.
   * @param jobId - Internal canonical job identifier to scrape.
   * @returns Newly created durable scheduler task.
   */
  createJobDetailScrapeTask(jobId: CanonicalJobIdType): DBSchedulerTaskRowType {
    return this.schedulerTaskRepository.createJobDetailScrapeTask({
      job_id: jobId,
    });
  }

  /**
   * Creates pending job-detail scrape tasks in one transaction.
   * @param jobIds - Internal canonical job identifiers to scrape.
   * @returns Newly created durable scheduler tasks in the supplied job order.
   */
  batchCreateJobDetailScrapeTasks(
    jobIds: CanonicalJobIdType[],
  ): DBSchedulerTaskRowType[] {
    try {
      return this.schedulerTaskRepository.createJobDetailScrapeTasks(jobIds);
    } catch (error) {
      const isDatabaseBusy = isDatabaseBusyError(error);

      throw new PersistenceError(
        "Failed to create LinkedIn job-detail scrape tasks.",
        isDatabaseBusy ? "DATABASE_BUSY" : "DATABASE_ERROR",
        isDatabaseBusy,
        error,
      );
    }
  }
}
