import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type { CanonicalJobIdType } from "@/types/job-repository.type.js";
import type {
  DBJobStructureRowType,
  FindJobStructureByJobIdParamsType,
  InsertJobStructureParamsType,
  JobStructureUpsertInputType,
  UpdateJobStructureParamsType,
} from "@/types/job-structure.type.js";

export class JobStructureRepository {
  private readonly findByJobIdStatement: BetterSqlite3.Statement<
    [FindJobStructureByJobIdParamsType],
    DBJobStructureRowType
  >;

  private readonly listJobIdsNeedingParseStatement: BetterSqlite3.Statement<
    [{ parser_version: string }],
    { job_id: CanonicalJobIdType }
  >;

  private readonly insertStatement: BetterSqlite3.Statement<
    [InsertJobStructureParamsType]
  >;

  private readonly updateStatement: BetterSqlite3.Statement<
    [UpdateJobStructureParamsType]
  >;

  constructor(private readonly database: DatabaseConnectionType) {
    this.findByJobIdStatement = database.prepare(
      `
      SELECT *
      FROM job_structures
      WHERE job_id = @job_id;
    `,
    );

    /**
     * The sweep's question: every job that has markup but no current
     * structure. Covers three cases at once - never parsed, parsed by an
     * older parser, and parsed from markup that has since been re-scraped.
     */
    this.listJobIdsNeedingParseStatement = database.prepare(
      `
      SELECT d.job_id
      FROM job_details d
      LEFT JOIN job_structures s ON s.job_id = d.job_id
      WHERE d.description_html IS NOT NULL
        AND length(d.description_html) > 0
        AND (s.job_id IS NULL OR s.parser_version != @parser_version)
      ORDER BY d.job_id;
    `,
    );

    this.insertStatement = database.prepare(
      `
      INSERT INTO job_structures (
        job_id,
        structure_json,
        schema_version,
        parser_version,
        source_content_hash,
        parsed_at,
        created_at,
        updated_at
      )
      VALUES (
        @job_id,
        @structure_json,
        @schema_version,
        @parser_version,
        @source_content_hash,
        @parsed_at,
        @created_at,
        @updated_at
      );
    `,
    );

    this.updateStatement = database.prepare(
      `
      UPDATE job_structures
      SET
        structure_json = @structure_json,
        schema_version = @schema_version,
        parser_version = @parser_version,
        source_content_hash = @source_content_hash,
        parsed_at = @parsed_at,
        updated_at = @updated_at
      WHERE job_id = @job_id;
    `,
    );
  }

  /**
   * Finds the current structure for a canonical job.
   * @param jobId - Internal canonical job identifier.
   * @returns Stored structure, if one exists.
   */
  findByJobId(jobId: CanonicalJobIdType) {
    return this.findByJobIdStatement.get({ job_id: jobId });
  }

  /**
   * Lists jobs whose description has no structure from the current parser.
   * @param parserVersion - Version the sweep considers current.
   * @returns Canonical job identifiers needing a parse, oldest first.
   */
  listJobIdsNeedingParse(parserVersion: string): CanonicalJobIdType[] {
    return this.listJobIdsNeedingParseStatement
      .all({ parser_version: parserVersion })
      .map((row) => row.job_id);
  }

  /**
   * Stores the structure parsed for one job, replacing any earlier one.
   * @param input - Parsed structure and the provenance that produced it.
   * @returns Persisted row and insert status.
   */
  upsertJobStructure(input: JobStructureUpsertInputType) {
    const existing = this.findByJobId(input.jobId);
    const timestamp = new Date().toISOString();
    const columns = {
      job_id: input.jobId,
      structure_json: JSON.stringify(input.structure),
      schema_version: input.schemaVersion,
      parser_version: input.parserVersion,
      source_content_hash: input.sourceContentHash,
      parsed_at: timestamp,
      updated_at: timestamp,
    };

    if (existing) {
      this.updateStatement.run(columns);

      return {
        jobStructure: this.findByJobId(input.jobId)!,
        wasInserted: false,
      };
    }

    this.insertStatement.run({ ...columns, created_at: timestamp });

    return { jobStructure: this.findByJobId(input.jobId)!, wasInserted: true };
  }
}
