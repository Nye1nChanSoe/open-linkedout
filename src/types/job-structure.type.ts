import type { CanonicalJobIdType } from "@/types/job-repository.type.js";

/**
 * TODO: iterate more job descriptions and add other `description_text` section headers
 * For software engineering related jobs this is enough for now.
 */
export type JobSectionTypeType =
  | "overview"
  | "responsibilities"
  | "requirements"
  | "tech_stack"
  | "benefits"
  | "about_company"
  | "process"
  | "other";

/**
 * A bullet is a real <li>.
 * Everything else the ad renders is a <p>.
 */
export type JobBlockKindType = "paragraph" | "bullet";

export type JobBlockType = {
  kind: JobBlockKindType;
  text: string;
};

export type JobSectionType = {
  /** Null for the blocks that appear before the ad's first heading. */
  heading: string | null;
  sectionType: JobSectionTypeType;
  /** May be empty for a standalone heading or a parent before subsections. */
  blocks: JobBlockType[];
};

export type JobStructureType = {
  sections: JobSectionType[];
};

export type DBJobStructureRowType = {
  job_id: CanonicalJobIdType;

  /** JobStructureType as stored. Parse before use. */
  structure_json: string;

  schema_version: string;
  parser_version: string;

  /** Hash of the description_html this was parsed from. */
  source_content_hash: string;

  parsed_at: string;
  created_at: string;
  updated_at: string;
};

export type FindJobStructureByJobIdParamsType = {
  job_id: CanonicalJobIdType;
};

export type InsertJobStructureParamsType = DBJobStructureRowType;

export type UpdateJobStructureParamsType = Omit<
  DBJobStructureRowType,
  "created_at"
>;

/** Input for storing a freshly parsed structure. */
export type JobStructureUpsertInputType = {
  jobId: CanonicalJobIdType;
  structure: JobStructureType;
  schemaVersion: string;
  parserVersion: string;
  sourceContentHash: string;
};

export type JobStructureUpsertResultType = {
  jobStructure: DBJobStructureRowType;
  wasInserted: boolean;
};
