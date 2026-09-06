import type { JobApplicationStatusType } from "@/types/job-detail.type.js";

export type ScrapedJobType = {
  jobId: string;
  title: string;
  url: string;
  company?: string;
  location?: string;

  logoImageUrl?: string;

  /**
   * Machine-readable posting date from:
   *
   * <time datetime="2026-07-24">
   */
  postedDate?: string;

  /**
   * Human-readable text such as:
   *
   * "8 hours ago"
   */
  postedAgo?: string;

  /**
   * "$50/hr - $100/hr"
   */
  salary?: string;

  /**
   * Examples:
   *
   * "Actively reviewing applicants"
   * "Company review time is typically 1 week"
   * "1 school alum works here"
   */
  insights?: string[];

  /**
   * Boolean flags
   */
  isViewed: boolean;
  isPromoted: boolean;
  isEarlyApplicant: boolean;
  isEasyApply: boolean;
};


export type ScrapedJobDetailType = {
  /**
   * Visible text from the LinkedIn job-detail header, including job metadata.
   */
  headerText: string;

  /**
   * Full visible text from the LinkedIn job-description section.
   */
  descriptionText: string;

  /**
   * https://www.linkedin.com/jobs/view/<linkedin-jobid>
   */
  sourceUrl: string;

  /**
   * After clicking "Show Match Detail"
   * there's AI response text recommendation
   * LinkedIn feature
   */
  linkedinShowMatchDetailsAiText?: string;

  /**
   * Whether the loaded page still offers an application.
   */
  applicationStatus: JobApplicationStatusType;

  /**
   * Outbound apply URL, when the apply action is a link rather than a button.
   */
  externalApplyUrl?: string;
};
