import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  FindJobDiscoveriesByJobIdParamsType,
  FindJobDiscoveryParamsType,
  InsertJobDiscoveryParamsType,
  DBJobDiscoveryRowType,
  JobDiscoveryUpsertInputType,
  UpdateJobDiscoveryParamsType,
} from "@/types/job-discovery-repository.type.js";

export class JobDiscoveryRepository {
  private readonly findDiscoveryStatement: BetterSqlite3.Statement<
    [FindJobDiscoveryParamsType],
    DBJobDiscoveryRowType
  >;

  private readonly findByJobIdStatement: BetterSqlite3.Statement<
    [FindJobDiscoveriesByJobIdParamsType],
    DBJobDiscoveryRowType
  >;

  private readonly insertDiscoveryStatement: BetterSqlite3.Statement<
    [InsertJobDiscoveryParamsType]
  >;

  private readonly updateDiscoveryStatement: BetterSqlite3.Statement<
    [UpdateJobDiscoveryParamsType]
  >;

  constructor(private readonly database: DatabaseConnectionType) {
    this.findDiscoveryStatement = database.prepare(
      `
      SELECT *
      FROM job_discoveries
      WHERE job_id = @job_id
        AND keyword = @keyword
        AND search_location = @search_location
        AND page_number = @page_number;
    `,
    );

    this.findByJobIdStatement = database.prepare(
      `
      SELECT *
      FROM job_discoveries
      WHERE job_id = @job_id;
    `,
    );

    this.insertDiscoveryStatement = database.prepare(
      `
      INSERT INTO job_discoveries (
        job_id,
        keyword,
        search_location,
        page_number,
        position,
        is_promoted,
        discovered_at
      )
      VALUES (
        @job_id,
        @keyword,
        @search_location,
        @page_number,
        @position,
        @is_promoted,
        @discovered_at
    );
      `,
    );

    this.updateDiscoveryStatement = database.prepare(
      `
      UPDATE job_discoveries
      SET
        position = @position,
        is_promoted = @is_promoted,
        discovered_at = @discovered_at
      WHERE job_id = @job_id
        AND keyword = @keyword
        AND search_location = @search_location
        AND page_number = @page_number;
      `,
    );
  }

  /**
   * Finds a job discovery by its search-page identity.
   * @param input - Database job and search-page identity.
   * @returns Matching discovery, if present.
   */
  findDiscovery(
    input: FindJobDiscoveryParamsType,
  ) {
    return this.findDiscoveryStatement.get(input);
  }

  /**
   * Finds all discovery observations for one canonical job.
   * @param jobId - Canonical jobs table identifier.
   * @returns Discovery observations for the job.
   */
  findByJobId(jobId: number) {
    return this.findByJobIdStatement.all({ job_id: jobId });
  }

  /**
   * Creates or refreshes one job discovery observation.
   * @param input - Search-page observation data.
   * @returns Persisted discovery and insert status.
   */
  upsertDiscovery(
    input: JobDiscoveryUpsertInputType,
  ) {
    const identity: FindJobDiscoveryParamsType = {
      job_id: input.jobId,
      keyword: input.keyword,
      search_location: input.searchLocation,
      page_number: input.pageNumber,
    };

    const existingDiscovery = this.findDiscovery(identity);
    const timestamp = new Date().toISOString();

    if (existingDiscovery) {
      this.updateDiscoveryStatement.run({
        ...identity,
        position: input.position,
        is_promoted: Number(input.isPromoted),
        discovered_at: timestamp,
      });

      return {
        discovery: this.findDiscovery(identity)!,
        wasInserted: false,
      };
    }

    this.insertDiscoveryStatement.run({
      ...identity,
      position: input.position,
      is_promoted: Number(input.isPromoted),
      discovered_at: timestamp,
    });

    return {
      discovery: this.findDiscovery(identity)!,
      wasInserted: true,
    };
  }
}
