import { optionalAttribute, optionalText, requiredText } from "@/pages/extractor.utils.js";
import type { JobApplicationStatusType } from "@/types/job-detail.type.js";
import type { ScrapedJobDetailType } from "@/types/scraped-job.type.js";
import { JobDetailPage } from "./job-detail-page.js";

/**
 * Extracts raw data from a loaded LinkedIn job-detail page.
 *
 * @param jobDetailPage - Loaded LinkedIn job-detail page object.
 * @param applicationStatus - Availability classified while waiting for content.
 * @returns Structured raw job-detail data.
 */
export async function extractJobDetailData(
  jobDetailPage: JobDetailPage,
  applicationStatus: JobApplicationStatusType,
): Promise<ScrapedJobDetailType> {
  // An unavailable page renders neither block, so requiring them would turn a
  // known outcome back into an extraction failure.
  const isRendered = applicationStatus !== "unavailable";

  return {
    headerText: isRendered
      ? await requiredText(jobDetailPage.jobHeader, "header")
      : ((await optionalText(jobDetailPage.jobHeader)) ?? ""),
    descriptionText: isRendered
      ? await requiredText(jobDetailPage.description, "description")
      : ((await optionalText(jobDetailPage.description)) ?? ""),
    sourceUrl: jobDetailPage.currentUrl(),
    linkedinShowMatchDetailsAiText: await optionalText(
      jobDetailPage.matchDetailsText,
    ),
    applicationStatus,
    externalApplyUrl: await optionalAttribute(
      jobDetailPage.externalApplyLink,
      "href",
    ),
  };
}
