import { chromium } from "playwright";
import pc from "picocolors";
import scraperConfig from "@/config/scraper.config.js";
import domEventConfig from "@/config/dom-event.config.js";
import {
  buildDetailViewURLParams,
  debugDOMLogs,
  toScrapingError,
} from "@/utils/utils.js";
import { RetryPolicy } from "@/app/retry/retry-policy.js";
import { PersistJobDetailService } from "@/app/services/persist-job-detail.service.js";
import { createDatabaseConnection } from "@database/connection.js";
import { JobDetailRepository } from "@database/repositories/job-detail.repository.js";
import { JobRepository } from "@database/repositories/job.repository.js";
import { extractJobDetailData } from "@/pages/view/extractor.js";
import { JobDetailPage } from "@/pages/view/job-detail-page.js";
import { assertAuthenticated } from "./authentication.js";

// Troublesome LinkedIn job: it has since closed, which is what broke the
// header filter. Kept as the fixture for the closed-job path.
const JOB_ID = "4444891633";

const context = await chromium.launchPersistentContext(
  scraperConfig.PERSISTENT_BROWSER_DATA_PATH,
  {
    headless: scraperConfig.IS_HEADLESS,
    viewport: null,
  },
);

const page = context.pages()[0] ?? (await context.newPage());
await debugDOMLogs(page);

const retryPolicy = new RetryPolicy();

await retryPolicy.execute(
  { operationName: `navigate to LinkedIn job view - ${JOB_ID}` },
  async () => {
    try {
      return await page.goto(
        buildDetailViewURLParams(
          scraperConfig.SCRAPE_SITE_URLS.JOB_DETAIL,
          JOB_ID,
        ),
        {
          waitUntil: domEventConfig.EVENT_DOMCONTENTLOADED,
        },
      );
    } catch (error) {
      throw toScrapingError(error);
    }
  },
);

await assertAuthenticated(page);

const jobDetailPage = new JobDetailPage(page);
const applicationStatus = await jobDetailPage.waitForContent();

if (applicationStatus === "open") {
  await jobDetailPage.openMatchDetails();
}

const jobDetail = await extractJobDetailData(jobDetailPage, applicationStatus);
const {
  headerText,
  descriptionText,
  linkedinShowMatchDetailsAiText,
  sourceUrl,
} = jobDetail;

console.info(
  pc.green("Extracted detail"),
  pc.dim(":"),
  pc.cyan(applicationStatus),
  pc.dim("|"),
  pc.cyan(`${headerText.length} header chars`),
  pc.dim("|"),
  pc.cyan(`${descriptionText.length} description chars`),
  pc.dim("|"),
  linkedinShowMatchDetailsAiText
    ? pc.cyan(`${linkedinShowMatchDetailsAiText.length} AI match chars`)
    : pc.yellow("no AI match"),
);

const conn = createDatabaseConnection();
const jobRepository = new JobRepository(conn);
const canonicalJob = jobRepository.findByLinkedInJobId(JOB_ID);

if (!canonicalJob) {
  throw new Error(
    `Cannot persist details: LinkedIn job ${JOB_ID} was not discovered first.`,
  );
}

const persistJobDetailService = new PersistJobDetailService(
  new JobDetailRepository(conn),
);
persistJobDetailService.execute({
  jobId: canonicalJob.id,
  extractedJobDetail: jobDetail,
});

await new Promise(() => {});
