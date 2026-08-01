import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  CreateResumeInputType,
  DBResumeRowType,
  FindResumeByContentHashParamsType,
  FindResumeByIdParamsType,
  InsertResumeParamsType,
} from "@/types/resume.type.js";

export class ResumeRepository {
  private readonly findByIdStatement: BetterSqlite3.Statement<
    [FindResumeByIdParamsType],
    DBResumeRowType
  >;

  private readonly findByContentHashStatement: BetterSqlite3.Statement<
    [FindResumeByContentHashParamsType],
    DBResumeRowType
  >;

  private readonly insertResumeStatement: BetterSqlite3.Statement<
    [InsertResumeParamsType]
  >;

  constructor(private readonly database: DatabaseConnectionType) {
    this.findByIdStatement = database.prepare(
      `
      SELECT *
      FROM resumes
      WHERE id = @id;
    `,
    );

    this.findByContentHashStatement = database.prepare(
      `
      SELECT *
      FROM resumes
      WHERE content_hash = @content_hash;
    `,
    );

    this.insertResumeStatement = database.prepare(
      `
      INSERT INTO resumes (
        file_name,
        original_file_name,
        content_hash,
        source_format,
        file_size_bytes,
        created_at,
        updated_at
      )
      VALUES (
        @file_name,
        @original_file_name,
        @content_hash,
        @source_format,
        @file_size_bytes,
        @created_at,
        @updated_at
      );
    `,
    );
  }

  /**
   * @param id - Resume database identifier.
   * @returns Matching resume, if present.
   */
  findById(id: number) {
    return this.findByIdStatement.get({ id });
  }

  /**
   * @param contentHash - SHA-256 hash of the uploaded file.
   * @returns Matching resume, if present.
   */
  findByContentHash(contentHash: string) {
    return this.findByContentHashStatement.get({
      content_hash: contentHash,
    });
  }

  /**
   * @param input - Persisted file metadata for the new resume.
   * @returns Created resume record.
   */
  createResume(input: CreateResumeInputType) {
    const timestamp = new Date().toISOString();
    const result = this.insertResumeStatement.run({
      file_name: input.fileName,
      original_file_name: input.originalFileName,
      content_hash: input.contentHash,
      source_format: input.sourceFormat,
      file_size_bytes: input.fileSizeBytes,
      created_at: timestamp,
      updated_at: timestamp,
    });

    return this.findById(Number(result.lastInsertRowid))!;
  }
}
