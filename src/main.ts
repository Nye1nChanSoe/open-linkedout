import { serve } from "@hono/node-server";
import pc from "picocolors";

import { BrowserSession } from "@/app/browser/browser-session.js";
import { RestructRunner } from "@/app/documents/restruct-runner.js";
import { AppEventBus } from "@/app/events/app-event-bus.js";
import { RetryPolicy } from "@/app/retry/retry-policy.js";
import { Scheduler } from "@/app/scheduler/scheduler.js";
import { DiscoveryRunTask } from "@/app/scheduler/tasks/discovery-run.task.js";
import { JobDetailScrapeTask } from "@/app/scheduler/tasks/job-detail-scrape.task.js";
import { JobStructureTask } from "@/app/scheduler/tasks/job-structure.task.js";
import { ResumeExtractTask } from "@/app/scheduler/tasks/resume-extract.task.js";
import { CampaignService } from "@/app/services/campaign.service.js";
import { PersistDiscoveredJobsService } from "@/app/services/persist-discovered-jobs.service.js";
import { PersistJobDetailService } from "@/app/services/persist-job-detail.service.js";
import { ResumeExtractionService } from "@/app/services/resume-extraction.service.js";
import { ResumeService } from "@/app/services/resume.service.js";
import { JobStructureService } from "@/app/services/job-structure.service.js";
import { SchedulerTaskService } from "@/app/services/scheduler-task.service.js";
import { ScrapeAndPersistOrchestratorService } from "@/app/services/scrape-and-persist-orchestrator.service.js";
import { SchedulerWorker } from "@/app/workers/scheduler-worker.js";
import restructConfig from "@/config/restruct.config.js";
import serverConfig from "@/config/server.config.js";
import { JobsSearchPage } from "@/pages/search/job-search-page.js";
import { Paginator } from "@/pages/search/paginator.js";
import { Scroller } from "@/pages/search/scroller.js";
import { createApp } from "@/server/app.js";
import type { ServerDependenciesType } from "@/server/dependencies.js";
import { createDatabaseConnection } from "@database/connection.js";
import { CampaignRepository } from "@database/repositories/campaign.repository.js";
import { JobDetailRepository } from "@database/repositories/job-detail.repository.js";
import { JobDiscoveryRepository } from "@database/repositories/job-discovery.repository.js";
import { JobStructureRepository } from "@database/repositories/job-structure.repository.js";
import { JobRepository } from "@database/repositories/job.repository.js";
import { ResumeExtractionRepository } from "@database/repositories/resume-extraction.repository.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";
import { runMigrations } from "@database/migrate.js";

runMigrations();

const database = createDatabaseConnection();
const appEventBus = new AppEventBus();
const browserSession = new BrowserSession(appEventBus);
const retryPolicy = new RetryPolicy();

const campaignRepository = new CampaignRepository(database);
const jobRepository = new JobRepository(database);
const jobDetailRepository = new JobDetailRepository(database);
const jobDiscoveryRepository = new JobDiscoveryRepository(database);
const jobStructureRepository = new JobStructureRepository(database);
const resumeRepository = new ResumeRepository(database);
const resumeExtractionRepository = new ResumeExtractionRepository(database);
const schedulerTaskRepository = new SchedulerTaskRepository(database);

const schedulerTaskService = new SchedulerTaskService(schedulerTaskRepository);
const campaignService = new CampaignService(
  campaignRepository,
  schedulerTaskRepository,
  schedulerTaskService,
  appEventBus,
);
const resumeService = new ResumeService(resumeRepository, schedulerTaskService);
const jobStructureService = new JobStructureService(
  jobRepository,
  jobDetailRepository,
  jobStructureRepository,
  schedulerTaskService,
);

const dependencies: ServerDependenciesType = {
  appEventBus,
  browserSession,
  campaignService,
  resumeService,
  jobRepository,
  jobDetailRepository,
  jobDiscoveryRepository,
  resumeRepository,
  resumeExtractionRepository,
  schedulerTaskRepository,
};

/**
 * Builds the LinkedIn scraping scheduler.
 *
 * Everything here needs a page, so calling this is what opens the browser.
 * The worker only calls it once a scrape task is actually queued.
 * @returns Scheduler for the two LinkedIn task types.
 * TODO: move to factory
 */
async function createScrapeScheduler(): Promise<Scheduler> {
  const page = await browserSession.getPage();
  const jobSearchPage = new JobsSearchPage(page);

  const orchestrator = new ScrapeAndPersistOrchestratorService(
    new Scroller(jobSearchPage),
    new Paginator(jobSearchPage),
    new PersistDiscoveredJobsService(
      database,
      jobRepository,
      jobDiscoveryRepository,
    ),
    retryPolicy,
    schedulerTaskService,
    appEventBus,
  );

  return new Scheduler(
    schedulerTaskRepository,
    [
      new DiscoveryRunTask(
        orchestrator,
        page,
        retryPolicy,
        campaignService,
        appEventBus,
      ),
      new JobDetailScrapeTask(
        jobRepository,
        new PersistJobDetailService(jobDetailRepository),
        schedulerTaskService,
        page,
        retryPolicy,
        appEventBus,
      ),
    ],
    campaignService,
    appEventBus,
  );
}

/**
 * Builds the document scheduler. No browser is involved.
 * @returns Scheduler for resume extraction.
 * TODO: move to factory
 */
async function createDocumentScheduler(): Promise<Scheduler> {
  const resumeExtractor = new RestructRunner();

  // `--version` is answered before the extractor loads its weights, so
  // catching a mismatched install here costs nothing.
  const extractorVersion = await resumeExtractor.readVersion();

  if (extractorVersion !== restructConfig.PINNED_VERSION) {
    throw new Error(
      `Resume extractor ${extractorVersion} does not match the pinned ` +
        `${restructConfig.PINNED_VERSION}. Run \`npm run setup:extractor\`.`,
    );
  }

  return new Scheduler(
    schedulerTaskRepository,
    [
      new ResumeExtractTask(
        new ResumeExtractionService(
          resumeRepository,
          resumeExtractionRepository,
          resumeExtractor,
        ),
      ),
    ],
    campaignService,
    appEventBus,
  );
}

/**
 * Builds the parsing scheduler.
 *
 * Deliberately its own worker rather than sharing the document one: it needs
 * neither a browser nor the restruct binary, so it must not inherit that
 * scheduler's pinned-version check, and a slow resume extraction must not
 * stall a burst of parse tasks.
 * @returns Scheduler for job-structure parsing.
 * TODO: move to factory
 */
async function createParserScheduler(): Promise<Scheduler> {
  return new Scheduler(
    schedulerTaskRepository,
    [new JobStructureTask(jobStructureService)],
    campaignService,
    appEventBus,
  );
}

// Queues a parse for anything the current parser has not seen: jobs scraped
// before this task type existed, a crash between persisting a detail and
// queueing its parse, and every future parser version. Startup is the right
// place for it — the same reason recoverRunningTasks() lives there.
jobStructureService.queueOutdated();

const scrapeWorker = new SchedulerWorker(
  "Scrape worker",
  ["discovery_run", "job_detail_scrape"], // tasks this worker takes
  schedulerTaskRepository,
  createScrapeScheduler,
  serverConfig.WORKER_IDLE_POLL_INTERVAL_MS,
  // check stale, create new scheduler if it is.
  () => browserSession.isOpen() && !browserSession.isAlive(),
);

const parserWorker = new SchedulerWorker(
  "Parser worker",
  ["job_structure"],
  schedulerTaskRepository,
  createParserScheduler,
  serverConfig.WORKER_IDLE_POLL_INTERVAL_MS,
);

const documentWorker = new SchedulerWorker(
  "Document worker",
  ["resume_extract"], // tasks this worker takes
  schedulerTaskRepository,
  createDocumentScheduler,
  serverConfig.WORKER_IDLE_POLL_INTERVAL_MS,
);

const server = serve({
  fetch: createApp(dependencies).fetch,
  hostname: serverConfig.HOST,
  port: serverConfig.PORT,
});

console.info(
  pc.green("LinkedOut running"),
  pc.dim(":"),
  pc.cyan(`http://${serverConfig.HOST}:${serverConfig.PORT}`),
);

const workers = Promise.all([
  documentWorker.start(),
  scrapeWorker.start(),
  parserWorker.start(),
]);

let isShuttingDown = false;

/**
 * Stops the workers, the browser and the server once.
 * @param signal - Signal that asked the process to stop.
 */
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.info(pc.yellow(`\nShutting down on ${signal}...`));

  scrapeWorker.stop();
  parserWorker.stop();
  documentWorker.stop();
  server.close();

  await browserSession.close();
  database.close();

  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => void shutdown(signal));
}

await workers;
