/** Internal primary key for one canonical job record. */
export type CanonicalJobIdType = number;

/**
 * One real LinkedIn job record which is also canonical job for `job-discovery` observations
 */
export type DBJobRowType = {
  id: CanonicalJobIdType;
  linkedin_job_id: string;
  title: string;
  company: string | null;
  location: string | null;
  canonical_url: string;
  logo_image_url: string | null;
  posted_date: string | null;
  posted_ago: string | null;
  salary_text: string | null;
  insights_json: string | null;
  is_viewed: number;
  is_easy_apply: number;
  is_early_applicant: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type FindJobByLinkedInJobIdParamsType = {
  linkedin_job_id: string;
};

export type FindJobByIdParamsType = {
  id: number;
};

export type InsertJobParamsType = Omit<DBJobRowType, "id">;

export type UpdateJobParamsType = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  canonical_url: string;
  logo_image_url: string | null;
  posted_date: string | null;
  posted_ago: string | null;
  salary_text: string | null;
  insights_json: string | null;
  is_viewed: number;
  is_easy_apply: number;
  is_early_applicant: number;
  last_seen_at: string;
  updated_at: string;
};

export type JobUpsertInputType = {
  linkedinJobId: string;
  title: string;
  company?: string;
  location?: string;
  canonicalUrl: string;
  logoImageUrl?: string;
  postedDate?: string;
  postedAgo?: string;
  salaryText?: string;
  insights?: string[];
  isViewed: boolean;
  isEasyApply: boolean;
  isEarlyApplicant: boolean;
};

export type JobUpsertResultType = {
  job: DBJobRowType;
  wasInserted: boolean;
};
