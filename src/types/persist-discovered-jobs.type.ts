import type { ScrapedJobType } from "@/types/scraped-job.type.js";

/** Scraped jobs and search context from one LinkedIn results page. */
export type PersistDiscoveredJobsInputType = {
  keyword: string;
  searchLocation: string;
  pageNumber: number;
  jobs: ScrapedJobType[];
};

/** Counts produced after saving one LinkedIn results page. */
export type PersistDiscoveredJobsResultType = {
  receivedCount: number;
  uniqueJobCount: number;
  insertedJobCount: number;
  updatedJobCount: number;
  insertedDiscoveryCount: number;
  updatedDiscoveryCount: number;
};
