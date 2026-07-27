import pc from "picocolors";
import { chromium, type Page } from "playwright";
import scraperConfig from "@/config/scraper.config.js";
import domEventConfig from "@/config/dom-event.config.js";
import { buildURLParams, debugDOMLogs } from "@/utils/utils.js";
import { JobsSearchPage } from "@/pages/search/job-search-page.js";
import { Scroller } from "@/pages/search/scroller.js";
import { Paginator } from "@/pages/search/paginator.js";
import { PersistDiscoveredJobsService } from "@/app/services/persist-discovered-jobs.service.js";
import { createDatabaseConnection } from "@database/connection.js";
import { JobRepository } from "@database/repositories/job.repository.js";
import { JobDiscoveryRepository } from "@database/repositories/job-discovery.repository.js";
import { ScrapeAndPersistOrchestratorService } from "@/app/services/scrape-and-persist-orchestrator.service.js";

// TODO: THIS IS TEMPORARY SEARCH KEYWORDS
const SEARCH_KEYWORD = "software engineer";
const SEARCH_LOCATION = "bangkok";

const context = await chromium.launchPersistentContext(
  scraperConfig.PERSISTENT_BROWSER_DATA_PATH,
  {
    headless: scraperConfig.IS_HEADLESS,
    viewport: null,
  },
);

const page = context.pages()[0] ?? (await context.newPage());
await debugDOMLogs(page);

await page.bringToFront();

await page.goto(
  buildURLParams(
    scraperConfig.SCRAPE_SITE_URLS.JOB_SEARCH,
    SEARCH_KEYWORD,
    SEARCH_LOCATION,
  ),
  {
    waitUntil: domEventConfig.EVENT_DOMCONTENTLOADED,
  },
);

const conn = createDatabaseConnection();
const jobRepository = new JobRepository(conn);
const jobDiscoveryRepository = new JobDiscoveryRepository(conn);

const jobSearchPage = new JobsSearchPage(page);
const scroller = new Scroller(jobSearchPage);
const paginator = new Paginator(jobSearchPage);

const persistJobService = new PersistDiscoveredJobsService(
  conn,
  jobRepository,
  jobDiscoveryRepository,
);

// orchestrator
const orchestor = new ScrapeAndPersistOrchestratorService(
  scroller,
  paginator,
  persistJobService,
);

await orchestor.execute({
  keyword: SEARCH_KEYWORD,
  searchLocation: SEARCH_LOCATION,
  maxPages: 5,
});

// debugging
await new Promise(() => {});
