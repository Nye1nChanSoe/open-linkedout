import { chromium } from "playwright";
import pc from "picocolors";

import { RetryPolicy } from "@/app/retry/retry-policy.js";
import { Scheduler } from "@/app/scheduler/scheduler.js";
import { DiscoveryRunTask } from "@/app/scheduler/tasks/discovery-run.task.js";
import { JobDetailScrapeTask } from "@/app/scheduler/tasks/job-detail-scrape.task.js";
import { SchedulerTaskService } from "@/app/services/scheduler-task.service.js";
import { PersistDiscoveredJobsService } from "@/app/services/persist-discovered-jobs.service.js";
import { PersistJobDetailService } from "@/app/services/persist-job-detail.service.js";
import { ScrapeAndPersistOrchestratorService } from "@/app/services/scrape-and-persist-orchestrator.service.js";
import scraperConfig from "@/config/scraper.config.js";
import { createDatabaseConnection } from "@database/connection.js";
import { JobDiscoveryRepository } from "@database/repositories/job-discovery.repository.js";
import { JobDetailRepository } from "@database/repositories/job-detail.repository.js";
import { JobRepository } from "@database/repositories/job.repository.js";
import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";
import { Paginator } from "@/pages/search/paginator.js";
import { JobsSearchPage } from "@/pages/search/job-search-page.js";
import { Scroller } from "@/pages/search/scroller.js";
import { debugDOMLogs, sleep } from "@/utils/utils.js";

const conn = createDatabaseConnection();
const context = await chromium.launchPersistentContext(
  scraperConfig.PERSISTENT_BROWSER_DATA_PATH,
  {
    headless: scraperConfig.IS_HEADLESS,
    viewport: null,
  },
);

try {
  const page = context.pages()[0] ?? (await context.newPage());

  const retryPolicy = new RetryPolicy();
  const jobSearchPage = new JobsSearchPage(page);

  const schedulerTaskRepository = new SchedulerTaskRepository(conn);

  const schedulerTaskService = new SchedulerTaskService(
    schedulerTaskRepository,
  );
  // TODO: Remove after task creation is handled by a command or dashboard.
  // This is root task to start a chain of scheduled tasks
  schedulerTaskService.createDiscoveryRunTask({
    keyword: "software engineer",
    searchLocation: "Vietnam",
    maxPages: 1,
  });

  const jobRepository = new JobRepository(conn);
  const jobDiscoveryRepository = new JobDiscoveryRepository(conn);

  const persistenceService = new PersistDiscoveredJobsService(
    conn,
    jobRepository,
    jobDiscoveryRepository,
  );

  const persistJobDetailService = new PersistJobDetailService(
    new JobDetailRepository(conn),
  );

  const orchestrator = new ScrapeAndPersistOrchestratorService(
    new Scroller(jobSearchPage),
    new Paginator(jobSearchPage),
    persistenceService,
    retryPolicy,
    schedulerTaskService,
  );

  const discoveryRunTask = new DiscoveryRunTask(
    orchestrator,
    page,
    retryPolicy,
  );

  const jobDetailScrapeTask = new JobDetailScrapeTask(
    jobRepository,
    persistJobDetailService,
    page,
    retryPolicy,
  );

  const scheduler = new Scheduler(schedulerTaskRepository, [
    discoveryRunTask,
    jobDetailScrapeTask,
  ]);

  await debugDOMLogs(page);
  await page.bringToFront();

  scheduler.recoverInterruptedTasks();
  while (await scheduler.run()) {}

  console.info(
    pc.green("Scheduler finished."),
    pc.yellow("Browser will close in 1 minute."),
  );

  await sleep(60_000);
} finally {
  await context.close();
  conn.close();
}
