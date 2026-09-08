import type { CanonicalJobIdType } from "@/types/job-repository.type.js";

export type JobWorkplaceTypeType = "on_site" | "remote" | "hybrid";

export type JobEmploymentTypeType =
  | "full_time"
  | "part_time"
  | "contract"
  | "temporary"
  | "internship"
  | "volunteer"
  | "other";

/** Eligibility facts stated only in the job-detail header. */
export type JobHeaderFactsType = {
  workplaceType: JobWorkplaceTypeType | null;
  employmentType: JobEmploymentTypeType | null;
  applicantCount: number | null;

  /** LinkedIn reports "Over 100", so the count above is then a floor. */
  isApplicantCountCapped: boolean;
};

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

  /** NULL for rows scraped before the description was captured as HTML. */
  description_html: string | null;
  source_url: string;
  external_apply_url: string | null;
  linkedin_show_match_details_ai_text: string | null;
  application_status: JobApplicationStatusType;
  workplace_type: JobWorkplaceTypeType | null;
  employment_type: JobEmploymentTypeType | null;
  applicant_count: number | null;
  is_applicant_count_capped: number;
  fetched_at: string;
  next_refresh_at: string | null;
  created_at: string;
  updated_at: string;
};

/** json_each over an id array keeps one prepared statement for any batch size. */
export type FindJobDetailsByJobIdsParamsType = {
  job_ids_json: string;
};

export type FindJobDetailByJobIdParamsType = {
  job_id: CanonicalJobIdType;
};

export type InsertJobDetailParamsType = DBJobDetailRowType;

export type UpdateJobDetailParamsType = {
  job_id: CanonicalJobIdType;
  header_text: string;
  description_text: string;

  /** NULL for rows scraped before the description was captured as HTML. */
  description_html: string | null;
  source_url: string;
  external_apply_url: string | null;
  linkedin_show_match_details_ai_text: string | null;
  application_status: JobApplicationStatusType;
  workplace_type: JobWorkplaceTypeType | null;
  employment_type: JobEmploymentTypeType | null;
  applicant_count: number | null;
  is_applicant_count_capped: number;
  fetched_at: string;
  next_refresh_at: string | null;
  updated_at: string;
};

// Input type for insert or upsert
export type JobDetailUpsertInputType = {
  jobId: CanonicalJobIdType;
  headerText: string;
  descriptionText: string;

  /** Omitted by callers that could not read markup, such as a closed job. */
  descriptionHtml?: string | null;
  sourceUrl: string;
  headerFacts?: JobHeaderFactsType;
  externalApplyUrl?: string | null;
  linkedinShowMatchDetailsAiText?: string | null;
  applicationStatus?: JobApplicationStatusType;
  nextRefreshAt?: string | null;
};

export type JobDetailUpsertResultType = {
  jobDetail: DBJobDetailRowType;
  wasInserted: boolean;
};
