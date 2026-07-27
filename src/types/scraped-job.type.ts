export type ScrapedJobType = {
  jobId: string;
  title: string;
  url: string;
  company: string;
  location: string;

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
