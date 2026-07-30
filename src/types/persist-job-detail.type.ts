import type { JobDetailUpsertResultType } from "@/types/job-detail.type.js";
import type { ScrapedJobDetailType } from "@/types/scraped-job.type.js";

export type PersistJobDetailInputType = {
  jobId: number;
  extractedJobDetail: ScrapedJobDetailType;
};

export type PersistJobDetailResultType = JobDetailUpsertResultType;
