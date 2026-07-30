import { optionalText, requiredText } from "@/pages/extractor.utils.js";
import type { ScrapedJobDetailType } from "@/types/scraped-job.type.js";
import { JobDetailPage } from "./job-detail-page.js";

/**
 * Extracts raw data from a loaded LinkedIn job-detail page.
 *
 * @param jobDetailPage - Loaded LinkedIn job-detail page object.
 * @returns Structured raw job-detail data.
 */
export async function extractJobDetailData(
  jobDetailPage: JobDetailPage,
): Promise<ScrapedJobDetailType> {
  return {
    headerText: await requiredText(jobDetailPage.jobHeader, "header"),
    descriptionText: await requiredText(
      jobDetailPage.description,
      "description",
    ),
    sourceUrl: jobDetailPage.currentUrl(),
    linkedinShowMatchDetailsAiText: await optionalText(
      jobDetailPage.matchDetailsText,
    ),
  };
}
