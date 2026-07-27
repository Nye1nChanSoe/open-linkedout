/**
 * Job discovery observation for multiple scrapes could end up with finding some jobs in certain pages
 * The service will upsert the canonical job if certain observation criterias are passed
 */
export type DBJobDiscoveryRowType = {
  id: number;
  job_id: number;
  keyword: string;
  search_location: string;
  page_number: number;
  position: number;
  is_promoted: number;
  discovered_at: string;
};

/**
 * Identity check type for job observation
 * meaning no new record should be created but upsert.
 * same page | same keyword | same job and same search location
 */
export type JobDiscoveryIdentityType = {
  job_id: number;
  keyword: string;
  search_location: string;
  page_number: number;
};

export type FindJobDiscoveryParamsType = JobDiscoveryIdentityType;

export type FindJobDiscoveriesByJobIdParamsType = {
  job_id: number;
};

export type InsertJobDiscoveryParamsType = Omit<DBJobDiscoveryRowType, "id">;

export type UpdateJobDiscoveryParamsType = JobDiscoveryIdentityType & {
  position: number;
  is_promoted: number;
  discovered_at: string;
};

export type JobDiscoveryUpsertInputType = {
  jobId: number;
  keyword: string;
  searchLocation: string;
  pageNumber: number;
  position: number;
  isPromoted: boolean;
};

export type JobDiscoveryUpsertResultType = {
  discovery: DBJobDiscoveryRowType;
  wasInserted: boolean;
};
