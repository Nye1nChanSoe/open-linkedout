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
