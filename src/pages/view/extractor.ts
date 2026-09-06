import { optionalAttribute, optionalText } from "@/pages/extractor.utils.js";
import { requiredText } from "@/pages/extractor.utils.js";
import type { JobApplicationStatusType } from "@/types/job-detail.type.js";
import type { ScrapedJobDetailType } from "@/types/scraped-job.type.js";
import { JobDetailPage } from "./job-detail-page.js";

/**
 * Extracts raw data from a loaded LinkedIn job-detail page.
 *
 * The description is required: it is the field nothing else supplies. Header
 * text is optional, because the canonical job row already carries the title,
 * company and location it repeats.
 * @param jobDetailPage - Loaded LinkedIn job-detail page object.
 * @param applicationStatus - Availability classified while waiting for content.
 * @returns Structured raw job-detail data.
 */
export async function extractJobDetailData(
  jobDetailPage: JobDetailPage,
  applicationStatus: JobApplicationStatusType,
): Promise<ScrapedJobDetailType> {
  const header = await jobDetailPage.findHeader();
  const isRendered = applicationStatus !== "unavailable";

  return {
    headerText: header ? ((await optionalText(header)) ?? "") : "",
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
