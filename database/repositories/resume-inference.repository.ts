import type BetterSqlite3 from "better-sqlite3";

import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  DBResumeInferenceRowType,
  FindResumeInferenceByResumeIdParamsType,
  InsertResumeInferenceParamsType,
  ResumeInferenceUpsertInputType,
  UpdateResumeInferenceParamsType,
} from "@/types/resume-inference.type.js";

export class ResumeInferenceRepository {
  private readonly findByResumeIdStatement: BetterSqlite3.Statement<
    [FindResumeInferenceByResumeIdParamsType],
    DBResumeInferenceRowType
  >;

  private readonly insertResumeInferenceStatement: BetterSqlite3.Statement<
    [InsertResumeInferenceParamsType]
  >;

  private readonly updateResumeInferenceStatement: BetterSqlite3.Statement<
    [UpdateResumeInferenceParamsType]
  >;

  constructor(private readonly database: DatabaseConnectionType) {
    this.findByResumeIdStatement = database.prepare(
      `
      SELECT *
      FROM resume_inferences
      WHERE resume_id = @resume_id;
    `,
    );

    this.insertResumeInferenceStatement = database.prepare(
      `
      INSERT INTO resume_inferences (
        resume_id,
        inference_json,
        source_text_hash,
        model_name,
        prompt_version,
        schema_version,
        inference_config_json,
        created_at,
        updated_at
      )
      VALUES (
        @resume_id,
        @inference_json,
        @source_text_hash,
        @model_name,
        @prompt_version,
        @schema_version,
        @inference_config_json,
        @created_at,
        @updated_at
      );
    `,
    );

    this.updateResumeInferenceStatement = database.prepare(
      `
      UPDATE resume_inferences
      SET
        inference_json = @inference_json,
        source_text_hash = @source_text_hash,
        model_name = @model_name,
        prompt_version = @prompt_version,
        schema_version = @schema_version,
        inference_config_json = @inference_config_json,
        updated_at = @updated_at
      WHERE resume_id = @resume_id;
    `,
    );
  }

  /**
   * @param resumeId - Resume database identifier.
   * @returns Matching current inference, if present.
   */
  findByResumeId(resumeId: number) {
    return this.findByResumeIdStatement.get({ resume_id: resumeId });
  }

  /**
   * @param input - Validated inference and its source provenance.
   * @returns Persisted current inference and insert status.
   */
  upsertInference(input: ResumeInferenceUpsertInputType) {
    const existingInference = this.findByResumeId(input.resumeId);
    const timestamp = new Date().toISOString();
    const inferenceJson = JSON.stringify(input.inference);
    const inferenceConfigJson = JSON.stringify(input.inferenceConfig);

    if (existingInference) {
      this.updateResumeInferenceStatement.run({
        resume_id: input.resumeId,
        inference_json: inferenceJson,
        source_text_hash: input.sourceTextHash,
        model_name: input.modelName,
        prompt_version: input.promptVersion,
        schema_version: input.schemaVersion,
        inference_config_json: inferenceConfigJson,
        updated_at: timestamp,
      });

      return {
        resumeInference: this.findByResumeId(input.resumeId)!,
        wasInserted: false,
      };
    }

    this.insertResumeInferenceStatement.run({
      resume_id: input.resumeId,
      inference_json: inferenceJson,
      source_text_hash: input.sourceTextHash,
      model_name: input.modelName,
      prompt_version: input.promptVersion,
      schema_version: input.schemaVersion,
      inference_config_json: inferenceConfigJson,
      created_at: timestamp,
      updated_at: timestamp,
    });

    return {
      resumeInference: this.findByResumeId(input.resumeId)!,
      wasInserted: true,
    };
  }
}
