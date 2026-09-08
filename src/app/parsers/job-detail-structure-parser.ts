import type {
  JobEmploymentTypeType,
  JobHeaderFactsType,
  JobWorkplaceTypeType,
} from "@/types/job-detail.type.js";


/**
 * Exact matching for `chips`
 * Regex only for the `count`
 */

/**
 * LinkedIn renders each chip as its own element, so a chip is always a line
 * of its own in the header text.
 *
 * Matching whole lines rather than substrings is what stops a title like
 * "Remote Frontend Developer" being read as a workplace chip.
 *
 * TODO: Later i can decide if this dictionary grows, can move them into separate dict file
 */
const WORKPLACE_TYPE_BY_LABEL: Record<string, JobWorkplaceTypeType> = {
  "on-site": "on_site",
  onsite: "on_site",
  remote: "remote",
  hybrid: "hybrid",
};

const EMPLOYMENT_TYPE_BY_LABEL: Record<string, JobEmploymentTypeType> = {
  "full-time": "full_time",
  "part-time": "part_time",
  contract: "contract",
  temporary: "temporary",
  internship: "internship",
  volunteer: "volunteer",
  other: "other",
};

/**
 * Both wordings are the same fact: how many people the posting has drawn.
 * "Over 100" is a ceiling on LinkedIn's counter, not on the applicants.
 */
const APPLICANT_COUNT_PATTERN =
  /(over\s+)?([\d,]+)\s+(?:applicants?|people\s+clicked\s+apply)/i;

/**
 * Reads the eligibility facts LinkedIn shows only in the detail header.
 * @param headerText - Visible header text from the job-detail page.
 * @returns Facts stated in the header; each is null when it is not stated.
 * 
 * Current called directly in extractor.ts: headerFacts: parseJobHeaderFacts(headerText),
 */
export function parseJobHeaderFacts(headerText: string): JobHeaderFactsType {
  const lines = headerText
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);

  return {
    workplaceType: findChip(lines, WORKPLACE_TYPE_BY_LABEL),
    employmentType: findChip(lines, EMPLOYMENT_TYPE_BY_LABEL),
    ...parseApplicantCount(headerText),
  };
}

/**
 * Finds the first line that is exactly one of the known chip labels.
 * @param lines - Trimmed, lowercased header lines.
 * @param typeByLabel - Recognised labels and what they mean.
 * @returns Matching value, or null when the chip is absent.
 */
function findChip<T>(
  lines: string[],
  typeByLabel: Record<string, T>,
): T | null {
  for (const line of lines) {
    const type = typeByLabel[line];

    if (type !== undefined) return type;
  }

  return null;
}

/**
 * Reads the applicant count out of the header metadata line.
 * @param headerText - Visible header text from the job-detail page.
 * @returns Count and whether LinkedIn capped it.
 */
function parseApplicantCount(
  headerText: string,
): Pick<JobHeaderFactsType, "applicantCount" | "isApplicantCountCapped"> {
  const match = headerText.match(APPLICANT_COUNT_PATTERN);

  if (!match) return { applicantCount: null, isApplicantCountCapped: false };

  const count = Number(match[2].replaceAll(",", ""));

  if (!Number.isFinite(count)) {
    return { applicantCount: null, isApplicantCountCapped: false };
  }

  return {
    applicantCount: count,
    isApplicantCountCapped: Boolean(match[1]),
  };
}
