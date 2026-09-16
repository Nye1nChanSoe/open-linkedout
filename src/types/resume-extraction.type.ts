export type RestructResumeDocumentType = {
  schema_version: string;
  [section: string]: unknown;
};

/** The prose fields every restruct v1 entry carries. */
export type RestructTextEntryType = {
  paragraphs: string[];
  bullets: string[];
};

/**
 * The parts of a restruct v1 document that hold matchable text, following
 * resume.schema.json at the project root. Every other
 * field (titles, companies, dates, urls, header_profile) is context, not prose.
 * A null section means the resume had no such section.
 */
export type RestructResumeTextType = {
  summary: {
    content: { type: "paragraph" | "bullet" | "subheading"; text: string }[];
  } | null;
  experience: RestructTextEntryType[] | null;
  education: (RestructTextEntryType & { skills: string[] })[] | null;
  skills: RestructTextEntryType[] | null;
  projects: RestructTextEntryType[] | null;
  certifications: RestructTextEntryType[] | null;
  licenses: RestructTextEntryType[] | null;
  tools_equipment: RestructTextEntryType[] | null;
  languages: RestructTextEntryType[] | null;
  volunteering: RestructTextEntryType[] | null;
  awards: RestructTextEntryType[] | null;
  publications: RestructTextEntryType[] | null;
  references: RestructTextEntryType[] | null;
  interests: RestructTextEntryType[] | null;
  others:
    | {
        heading: string;
        entries: (RestructTextEntryType & {
          attributes: { type: string; value: string }[];
        })[];
      }[]
    | null;
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
