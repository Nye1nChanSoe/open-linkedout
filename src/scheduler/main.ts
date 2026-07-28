import { chromium } from "playwright";
import pc from "picocolors";

import { RetryPolicy } from "@/app/retry/retry-policy.js";
import { Scheduler } from "@/app/scheduler/scheduler.js";
import { DiscoveryRunWorker } from "@/app/scheduler/workers/discovery-run.worker.js";
import { CreateDiscoveryRunTaskService } from "@/app/services/create-discovery-run-task.service.js";
import { PersistDiscoveredJobsService } from "@/app/services/persist-discovered-jobs.service.js";
import { ScrapeAndPersistOrchestratorService } from "@/app/services/scrape-and-persist-orchestrator.service.js";
import scraperConfig from "@/config/scraper.config.js";
import { createDatabaseConnection } from "@database/connection.js";
import { JobDiscoveryRepository } from "@database/repositories/job-discovery.repository.js";
import { JobRepository } from "@database/repositories/job.repository.js";
import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";
import { Paginator } from "@/pages/search/paginator.js";
import { JobsSearchPage } from "@/pages/search/job-search-page.js";
import { Scroller } from "@/pages/search/scroller.js";
import { debugDOMLogs, sleep } from "@/utils/utils.js";

const database = createDatabaseConnection();
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

  const schedulerTaskRepository = new SchedulerTaskRepository(database);

  // TODO: Remove after task creation is handled by a command or dashboard.
  const createOneTask = new CreateDiscoveryRunTaskService(
    schedulerTaskRepository,
  );
  createOneTask.execute({
    keyword: "software engineer",
    searchLocation: "thailand",
    maxPages: 10,
  });

  const jobRepository = new JobRepository(database);
  const jobDiscoveryRepository = new JobDiscoveryRepository(database);

  const persistenceService = new PersistDiscoveredJobsService(
    database,
    jobRepository,
    jobDiscoveryRepository,
  );

  const orchestrator = new ScrapeAndPersistOrchestratorService(
    new Scroller(jobSearchPage),
    new Paginator(jobSearchPage),
    persistenceService,
    retryPolicy,
  );

  const worker = new DiscoveryRunWorker(orchestrator, page, retryPolicy);
  const scheduler = new Scheduler(schedulerTaskRepository, [worker]);

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
  database.close();
}
