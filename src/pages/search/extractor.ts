import type { ScrapedJobType } from "@/types/scraped-job.type.js";
import type { Locator } from "playwright";

import { searchLocatorConfig } from "@/config/linkedin-locators.config.js";
import {
  includesText,
  optionalAttribute,
  optionalText,
  optionalTexts,
  requiredAttribute,
  requiredText,
} from "@/pages/extractor.utils.js";

/**
 * Extracts structured data from one hydrated LinkedIn job card.
 */
export async function extractJobCardData(
  hydratedCard: Locator,
): Promise<ScrapedJobType> {
  const {
    jobIdAttribute,
    title,
    url,
    company,
    location,
    logoImage,
    postedAgo,
    postedDateAttribute,
    salary,
    insights,
    footerItems,
  } = searchLocatorConfig;

  const titleLink = hydratedCard.locator(url).first();
  const timeElement = hydratedCard.locator(postedAgo).first();
  const footerText = await hydratedCard.locator(footerItems).allInnerTexts();

  return {
    jobId: await requiredAttribute(hydratedCard, jobIdAttribute, "jobId"),

    title: await requiredText(hydratedCard.locator(title).first(), "title"),

    url: new URL(
      await requiredAttribute(titleLink, "href", "url"),
      "https://www.linkedin.com",
    ).toString(),

    company: await optionalText(hydratedCard.locator(company).first()),

    location: await optionalText(hydratedCard.locator(location).first()),

    logoImageUrl: await optionalAttribute(
      hydratedCard.locator(logoImage).first(),
      "src",
    ),

    postedDate: await optionalAttribute(timeElement, postedDateAttribute),

    postedAgo: await optionalText(timeElement),

    salary: await optionalText(hydratedCard.locator(salary).first()),

    insights: await optionalTexts(hydratedCard.locator(insights)),

    isViewed: includesText(footerText, "Viewed"),
    isPromoted: includesText(footerText, "Promoted"),
    isEarlyApplicant: includesText(footerText, "early applicant"),
    isEasyApply: includesText(footerText, "Easy Apply"),
  };
}
