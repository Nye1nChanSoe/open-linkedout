import type { ScrapedJobType } from "@/types/scraped-job.type.js";
import type { Locator } from "playwright";

import searchPageLocatorConfig from "@/config/search-page-locators.config.js";

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
  } = searchPageLocatorConfig;

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

    company: await requiredText(
      hydratedCard.locator(company).first(),
      "company",
    ),

    location: await requiredText(
      hydratedCard.locator(location).first(),
      "location",
    ),

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

async function requiredText(
  locator: Locator,
  fieldName: string,
): Promise<string> {
  const value = await optionalText(locator);

  if (!value)
    throw new Error(`Unable to extract required field: ${fieldName}.`);

  return value;
}

async function optionalText(locator: Locator): Promise<string | undefined> {
  if ((await locator.count()) === 0) {
    return undefined;
  }

  return (await locator.innerText()).trim() || undefined;
}

async function requiredAttribute(
  locator: Locator,
  attributeName: string,
  fieldName: string,
): Promise<string> {
  const value = await optionalAttribute(locator, attributeName);

  if (!value)
    throw new Error(`Unable to extract required field: ${fieldName}.`);

  return value;
}

async function optionalAttribute(
  locator: Locator,
  attributeName: string,
): Promise<string | undefined> {
  if ((await locator.count()) === 0) return undefined;
  return (await locator.getAttribute(attributeName))?.trim() || undefined;
}

async function optionalTexts(locator: Locator): Promise<string[] | undefined> {
  const values = (await locator.allInnerTexts())
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? [...new Set(values)] : undefined;
}

function includesText(values: string[], expected: string): boolean {
  return values.some((value) =>
    value.toLowerCase().includes(expected.toLowerCase()),
  );
}
