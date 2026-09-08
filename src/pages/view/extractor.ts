import { parseJobHeaderFacts } from "@/app/parsers/job-detail-structure-parser.js";
import { optionalAttribute, optionalText } from "@/pages/extractor.utils.js";
import { requiredText } from "@/pages/extractor.utils.js";
import type { JobApplicationStatusType } from "@/types/job-detail.type.js";
import type { ScrapedJobDetailType } from "@/types/scraped-job.type.js";
import { JobDetailPage } from "./job-detail-page.js";

/**
 * Extracts raw data from a loaded LinkedIn job-detail page.
 *
 * The description is required: it is the field nothing else supplies.
 * Header text is optional, because the canonical job row already carries 
 * the title, company and location it repeats.
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
  const headerText = header ? ((await optionalText(header)) ?? "") : "";

  return {
    headerText,
    ...(await extractDescription(jobDetailPage, isRendered)),
    sourceUrl: jobDetailPage.currentUrl(),
    headerFacts: parseJobHeaderFacts(headerText),
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

/**
 * Reads the description as both markup and text.
 *
 * Markup comes from the same slot the text does, not from the inner
 * `expandable-text-box`: LinkedIn nests <ul> inside the <p> wrapping that
 * box, so the HTML parser closes the box at the first list and it holds only
 * the opening paragraphs. Scoping to it silently truncates the description.
 *
 * The slot therefore also carries the "About the job" heading, the "… more"
 * control and the benefits panel. In markup those are addressable nodes the
 * structure parser can skip, which is the whole reason HTML is worth storing.
 * @param jobDetailPage - Loaded LinkedIn job-detail page object.
 * @param isRendered - Whether the page rendered a description at all.
 * @returns Description text and markup.
 */
async function extractDescription(
  jobDetailPage: JobDetailPage,
  isRendered: boolean,
): Promise<Pick<ScrapedJobDetailType, "descriptionText" | "descriptionHtml">> {
  if (!isRendered) {
    return {
      descriptionText: (await optionalText(jobDetailPage.description)) ?? "",
      descriptionHtml: null,
    };
  }

  await jobDetailPage.expandDescription();

  return {
    descriptionText: await requiredText(
      jobDetailPage.description,
      "description",
    ),
    descriptionHtml: await jobDetailPage.description.innerHTML(),
  };
}
