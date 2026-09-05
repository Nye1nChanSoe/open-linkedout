export type ResumeProcessingStatusType =
  | "pending" // waiting for extraction
  | "processing" // extraction is in progress
  | "completed" // extraction finished successfully
  | "needs_ocr" // the document needs OCR and this machine cannot run it
  | "failed"; // extraction could not be completed

export type ResumeSourceFormatType = "pdf" | "docx";

export type DBResumeRowType = {
  id: number;
  file_name: string;
  original_file_name: string;
  content_hash: string;
  source_format: ResumeSourceFormatType;
  file_size_bytes: number;
  processing_status: ResumeProcessingStatusType;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type FindResumeByIdParamsType = { id: number };

export type FindResumeByContentHashParamsType = { content_hash: string };

export type InsertResumeParamsType = {
  file_name: string;
  original_file_name: string;
  content_hash: string;
  source_format: ResumeSourceFormatType;
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
};

export type UpdateResumeProcessingStatusParamsType = {
  id: number;
  processing_status: ResumeProcessingStatusType;
  error_message: string | null;
  updated_at: string;
};

export type CreateResumeInputType = {
  fileName: string;
  originalFileName: string;
  contentHash: string;
  sourceFormat: ResumeSourceFormatType;
  fileSizeBytes: number;
};

export type ImportResumeInputType = {
  sourcePath: string;
};

export type ImportResumeResultType = {
  resume: DBResumeRowType;
  wasImported: boolean;
};
