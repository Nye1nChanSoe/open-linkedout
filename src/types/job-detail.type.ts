import type { CanonicalJobIdType } from "@/types/job-repository.type.js";

export type JobApplicationStatusType =
  | "unknown" // detail page was fetched, but application availability was unclear
  | "open" // detail page indicates an application can still be started
  | "closed" // detail page exists but explicitly indicates applications are closed
  | "unavailable"; // job detail page indicates the job is no longer available or accessible

export type DBJobDetailRowType = {
  // not LinkedIn job identifier
  job_id: CanonicalJobIdType;
  header_text: string;
  description_text: string;
  source_url: string;
  external_apply_url: string | null;
  linkedin_show_match_details_ai_text: string | null;
  application_status: JobApplicationStatusType;
  fetched_at: string;
  next_refresh_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FindJobDetailByJobIdParamsType = {
  job_id: CanonicalJobIdType;
};

export type InsertJobDetailParamsType = DBJobDetailRowType;

export type UpdateJobDetailParamsType = {
  job_id: CanonicalJobIdType;
  header_text: string;
  description_text: string;
  source_url: string;
  external_apply_url: string | null;
  linkedin_show_match_details_ai_text: string | null;
  application_status: JobApplicationStatusType;
  fetched_at: string;
  next_refresh_at: string | null;
  updated_at: string;
};

// Input type for insert or upsert
export type JobDetailUpsertInputType = {
  jobId: CanonicalJobIdType;
  headerText: string;
  descriptionText: string;
  sourceUrl: string;
  externalApplyUrl?: string | null;
  linkedinShowMatchDetailsAiText?: string | null;
  applicationStatus?: JobApplicationStatusType;
  nextRefreshAt?: string | null;
};

export type JobDetailUpsertResultType = {
  jobDetail: DBJobDetailRowType;
  wasInserted: boolean;
};
