import type { JobType } from "@/types/job.type.js";

export type SaveDiscoveredJobsInput = {
  keyword: string;
  searchLocation: string;
  pageNumber: number;
  jobs: JobType[];
};

export type SaveDiscoveredJobsResult = {
  receivedCount: number;
  uniqueJobCount: number;
  insertedJobCount: number;
  updatedJobCount: number;
  insertedDiscoveryCount: number;
};
