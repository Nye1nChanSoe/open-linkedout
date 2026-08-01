export type ResumeProcessingStatusType =
  | "pending" // waiting for text extraction
  | "processing" // text extraction is in progress
  | "completed" // text extraction finished successfully
  | "needs_ocr" // no usable native text was found
  | "failed"; // text extraction could not be completed

export type ResumeExtractionMethodType =
  | "native" // text extracted directly from the file
  | "ocr" // text produced through optical character recognition
  | "manual"; // text supplied or corrected by the user

export type ResumeSourceFormatType = "pdf" | "docx" | "txt";

export type DBResumeRowType = {
  id: number;
  file_name: string;
  original_file_name: string;
  content_hash: string;
  source_format: ResumeSourceFormatType;
  file_size_bytes: number;
  raw_text: string | null;
  normalized_text: string | null;
  page_count: number | null;
  extraction_method: ResumeExtractionMethodType | null;
  extractor_version: string | null;
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

export type CreateResumeInputType = {
  fileName: string;
  originalFileName: string;
  contentHash: string;
  sourceFormat: ResumeSourceFormatType;
  fileSizeBytes: number;
};


// 
export type ImportResumeInputType = {
  sourcePath: string;
};

export type ImportResumeResultType = {
  resume: DBResumeRowType;
  wasImported: boolean;
};
