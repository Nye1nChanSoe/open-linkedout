import type { PersistDiscoveredJobsResultType } from "@/types/persist-discovered-jobs.type.js";

/** Search context and page limit for a scrape-and-persist run. */
export type ScrapeAndPersistOrchestratorInputType = {
  keyword: string;
  searchLocation: string;
  maxPages: number;
};

/** Aggregate counts produced by a scrape-and-persist run. */
export type ScrapeAndPersistOrchestratorResultType =
  PersistDiscoveredJobsResultType & {
  scrapedPageCount: number;
};
