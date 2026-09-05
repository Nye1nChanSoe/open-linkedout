import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  DBResumeExtractionRowType,
  FindResumeExtractionByResumeIdParamsType,
  InsertResumeExtractionParamsType,
  ResumeExtractionUpsertInputType,
  UpdateResumeExtractionParamsType,
} from "@/types/resume-extraction.type.js";

export class ResumeExtractionRepository {
  private readonly findByResumeIdStatement: BetterSqlite3.Statement<
    [FindResumeExtractionByResumeIdParamsType],
    DBResumeExtractionRowType
  >;

  private readonly insertResumeExtractionStatement: BetterSqlite3.Statement<
    [InsertResumeExtractionParamsType]
  >;

  private readonly updateResumeExtractionStatement: BetterSqlite3.Statement<
    [UpdateResumeExtractionParamsType]
  >;

  constructor(private readonly database: DatabaseConnectionType) {
    this.findByResumeIdStatement = database.prepare(
      `
      SELECT *
      FROM resume_extractions
      WHERE resume_id = @resume_id;
    `,
    );

    this.insertResumeExtractionStatement = database.prepare(
      `
      INSERT INTO resume_extractions (
        resume_id,
        resume_json,
        schema_version,
        extractor_version,
        source_content_hash,
        artifact_path,
        extracted_at,
        created_at,
        updated_at
      )
      VALUES (
        @resume_id,
        @resume_json,
        @schema_version,
        @extractor_version,
        @source_content_hash,
        @artifact_path,
        @extracted_at,
        @created_at,
        @updated_at
      );
    `,
    );

    this.updateResumeExtractionStatement = database.prepare(
      `
      UPDATE resume_extractions
      SET
        resume_json = @resume_json,
        schema_version = @schema_version,
        extractor_version = @extractor_version,
        source_content_hash = @source_content_hash,
        artifact_path = @artifact_path,
        extracted_at = @extracted_at,
        updated_at = @updated_at
      WHERE resume_id = @resume_id;
    `,
    );
  }

  /**
   * @param resumeId - Resume database identifier.
   * @returns Matching current extraction, if present.
   */
  findByResumeId(resumeId: number) {
    return this.findByResumeIdStatement.get({ resume_id: resumeId });
  }

  /**
   * @param input - Extracted document and its source provenance.
   * @returns Persisted current extraction and insert status.
   */
  upsertExtraction(input: ResumeExtractionUpsertInputType) {
    const existingExtraction = this.findByResumeId(input.resumeId);
    const timestamp = new Date().toISOString();
    const resumeJson = JSON.stringify(input.document);

    if (existingExtraction) {
      this.updateResumeExtractionStatement.run({
        resume_id: input.resumeId,
        resume_json: resumeJson,
        schema_version: input.document.schema_version,
        extractor_version: input.extractorVersion,
        source_content_hash: input.sourceContentHash,
        artifact_path: input.artifactPath,
        extracted_at: timestamp,
        updated_at: timestamp,
      });

      return {
        resumeExtraction: this.findByResumeId(input.resumeId)!,
        wasInserted: false,
      };
    }

    this.insertResumeExtractionStatement.run({
      resume_id: input.resumeId,
      resume_json: resumeJson,
      schema_version: input.document.schema_version,
      extractor_version: input.extractorVersion,
      source_content_hash: input.sourceContentHash,
      artifact_path: input.artifactPath,
      extracted_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    });

    return {
      resumeExtraction: this.findByResumeId(input.resumeId)!,
      wasInserted: true,
    };
  }
}
