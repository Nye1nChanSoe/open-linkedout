import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  CreateResumeInputType,
  DBResumeRowType,
  FindResumeByContentHashParamsType,
  FindResumeByIdParamsType,
  InsertResumeParamsType,
  ResumeProcessingStatusType,
  SaveNativeResumeExtractionParamsType,
  UpdateResumeProcessingStatusParamsType,
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

  private readonly updateProcessingStatusStatement: BetterSqlite3.Statement<
    [UpdateResumeProcessingStatusParamsType]
  >;

  private readonly saveNativeExtractionStatement: BetterSqlite3.Statement<
    [SaveNativeResumeExtractionParamsType]
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

    this.updateProcessingStatusStatement = database.prepare(
      `
      UPDATE resumes
      SET
        processing_status = @processing_status,
        error_message = @error_message,
        updated_at = @updated_at
      WHERE id = @id;
    `,
    );

    this.saveNativeExtractionStatement = database.prepare(
      `
      UPDATE resumes
      SET
        raw_text = @raw_text,
        normalized_text = @normalized_text,
        page_count = @page_count,
        extraction_method = @extraction_method,
        processing_status = @processing_status,
        error_message = NULL,
        updated_at = @updated_at
      WHERE id = @id;
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

  /**
   * records extraction method as `native`, and changes status to `completed`.
   * @param id - Resume database identifier.
   * @param rawText - Text extracted directly from the source file.
   * @param normalizedText - Normalized text ready for later processing.
   * @param pageCount - Source PDF page count, when available.
   */
  saveNativeExtraction(
    id: number,
    rawText: string,
    normalizedText: string,
    pageCount: number | undefined,
  ) {
    this.saveNativeExtractionStatement.run({
      id,
      raw_text: rawText,
      normalized_text: normalizedText,
      page_count: pageCount ?? null,
      extraction_method: "native",
      processing_status: "completed",
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * @param id - Resume database identifier.
   * @param status - New resume processing status.
   * @param errorMessage - Processing failure description, if any.
   */
  updateProcessingStatus(
    id: number,
    status: ResumeProcessingStatusType,
    errorMessage?: string,
  ) {
    this.updateProcessingStatusStatement.run({
      id,
      processing_status: status,
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    });
  }
}
