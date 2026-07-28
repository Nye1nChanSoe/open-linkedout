import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";
import type {
  CreateDiscoveryRunTaskInputType,
  DBSchedulerTaskRowType,
} from "@/types/scheduler-task.type.js";

/**
 * Creates durable discovery-run tasks for the scheduler.
 */
export class CreateDiscoveryRunTaskService {
  /**
   * @param schedulerTaskRepository - Stores newly created scheduler tasks.
   */
  constructor(
    private readonly schedulerTaskRepository: SchedulerTaskRepository,
  ) {}

  /**
   * Creates one pending LinkedIn discovery-run task.
   * @param input - Search context and page limit for the discovery run.
   * @returns Newly created durable scheduler task.
   */
  execute(input: CreateDiscoveryRunTaskInputType): DBSchedulerTaskRowType {
    return this.schedulerTaskRepository.createDiscoveryRunTask(input);
  }
}
