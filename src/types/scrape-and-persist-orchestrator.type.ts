import type { PersistDiscoveredJobsResultType } from "@/types/persist-discovered-jobs.type.js";

/** Search context and page limit for a scrape-and-persist run. */
export type ScrapeAndPersistOrchestratorInputType = {
  keyword: string;
  searchLocation: string;
  maxPages: number;
  campaignId?: number;
  /**
   * Checked between pages. The page loop is the only long-running body in
   * the run, so it is the only place a cancellation can be observed.
   */
  isCancelled?: () => boolean;
};

/** Aggregate counts produced by a scrape-and-persist run. */
export type ScrapeAndPersistOrchestratorResultType =
  Omit<PersistDiscoveredJobsResultType, "canonicalJobIds"> & {
  scrapedPageCount: number;
  /** Whether the run stopped early because its campaign was cancelled. */
  wasCancelled: boolean;
};
