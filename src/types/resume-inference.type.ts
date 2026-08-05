import type { LLMResumeInferenceType } from "@/types/llm-resume-inference.type.js";

export type DBResumeInferenceRowType = {
  resume_id: number;

  // structured inferred json
  inference_json: string;

  // sha-256 source normalized text hash
  source_text_hash: string;

  // qwen3:4b
  model_name: string;

  // v1 | v2 etc...
  prompt_version: string;

  // v1 | v2 etc...
  schema_version: string;

  // context_window | temperature | predction tokens | thinking => ResumeInferenceConfigType
  inference_config_json: string;
  created_at: string;
  updated_at: string;
};

export type FindResumeInferenceByResumeIdParamsType = {
  resume_id: number;
};

export type InsertResumeInferenceParamsType = DBResumeInferenceRowType;

export type UpdateResumeInferenceParamsType = Omit<
  DBResumeInferenceRowType,
  "created_at"
>;

export type ResumeInferenceConfigType = {
  num_ctx: number;
  temperature: number;
  num_predict: number;
  think: boolean;
};

export type ResumeInferenceUpsertInputType = {
  resumeId: number;
  inference: LLMResumeInferenceType;
  sourceTextHash: string;
  modelName: string;
  promptVersion: string;
  schemaVersion: string;
  inferenceConfig: ResumeInferenceConfigType;
};

export type ResumeInferenceUpsertResultType = {
  resumeInference: DBResumeInferenceRowType;
  wasInserted: boolean;
};
