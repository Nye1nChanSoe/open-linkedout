export type RestructResumeDocumentType = {
  schema_version: string;
  [section: string]: unknown;
};

export type RestructExtractionResultType = {
  document: RestructResumeDocumentType;
  artifactPath: string;
};

export type DBResumeExtractionRowType = {
  resume_id: number;

  // the sixteen-key document, exactly as written to disk
  resume_json: string;

  // shape of resume_json, taken from the document
  schema_version: string;

  // restruct release that produced it
  extractor_version: string;

  // resumes.content_hash at the time of extraction
  source_content_hash: string;

  artifact_path: string | null;
  extracted_at: string;
  created_at: string;
  updated_at: string;
};

export type FindResumeExtractionByResumeIdParamsType = {
  resume_id: number;
};

export type InsertResumeExtractionParamsType = DBResumeExtractionRowType;

export type UpdateResumeExtractionParamsType = Omit<
  DBResumeExtractionRowType,
  "created_at"
>;

export type ResumeExtractionUpsertInputType = {
  resumeId: number;
  document: RestructResumeDocumentType;
  extractorVersion: string;
  sourceContentHash: string;
  artifactPath: string | null;
};

export type ResumeExtractionUpsertResultType = {
  resumeExtraction: DBResumeExtractionRowType;
  wasInserted: boolean;
};
