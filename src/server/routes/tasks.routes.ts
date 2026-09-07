import { Hono } from "hono";

import { readNumber, readPaging } from "@/server/request.js";
import type { ServerDependenciesType } from "@/server/dependencies.js";
import type {
  SchedulerTaskStatusType,
  SchedulerTaskType,
} from "@/types/scheduler-task.type.js";

const TASK_STATUSES: SchedulerTaskStatusType[] = [
  "pending",
  "running",
  "retry_wait",
  "completed",
  "failed",
  "cancelled",
];

const TASK_TYPES: SchedulerTaskType[] = [
  "discovery_run",
  "job_detail_scrape",
  "resume_extract",
];

/**
 * Queue routes backing the task dashboard.
 * @param dependencies - Repositories the routes read through.
 * @returns Router mounted under /api/tasks.
 */
export function createTaskRoutes(dependencies: ServerDependenciesType) {
  const routes = new Hono();

  routes.get("/", (context) => {
    const paging = readPaging(context);

    return context.json({
      tasks: dependencies.schedulerTaskRepository.listByStatus({
        ...paging,
        statuses: readList(context.req.queries("status"), TASK_STATUSES),
        taskTypes: readList(context.req.queries("taskType"), TASK_TYPES),
        campaignId: readNumber(context, "campaignId"),
      }),
      page: paging.page,
      pageSize: paging.limit,
    });
  });

  routes.get("/summary", (context) =>
    context.json({
      countsByStatus: dependencies.schedulerTaskRepository.countByStatus({
        campaignId: readNumber(context, "campaignId"),
      }),
    }),
  );

  return routes;
}

/**
 * Keeps only the query values that name something the scheduler knows.
 * @param values - Repeated query parameter values.
 * @param allowed - Values this application recognises.
 * @returns Recognised values, or undefined when none were supplied.
 */
function readList<T extends string>(
  values: string[] | undefined,
  allowed: T[],
): T[] | undefined {
  const recognized = (values ?? []).filter((value): value is T =>
    allowed.includes(value as T),
  );

  return recognized.length ? recognized : undefined;
}
