import { LLMError } from "@/app/errors/llm-error.js";
import type { LLMResumeInferenceType } from "@/types/llm-resume-inference.type.js";

/**
 * Parses and validates the minimum structure required before persisting an
 * Ollama resume-inference response.
 * @param content - JSON text returned by Ollama.
 * @returns Validated resume inference.
 */
export function parseResumeInference(content: string): LLMResumeInferenceType {
  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch (error) {
    throw new LLMError(
      "Ollama returned resume inference that is not valid JSON.",
      "LLM_INVALID_RESPONSE",
      false,
      error,
    );
  }

  if (!isResumeInference(value)) {
    throw new LLMError(
      "Ollama returned resume inference with an invalid structure.",
      "LLM_INVALID_RESPONSE",
      false,
    );
  }

  return value;
}

function isResumeInference(value: unknown): value is LLMResumeInferenceType {
  if (!isRecord(value)) return false;

  return (
    isNullableString(value.headline) &&
    isStringArray(value.targetRoles) &&
    isStringArray(value.skills) &&
    isArrayOf(value.experience, isExperience) &&
    isArrayOf(value.education, isEducation) &&
    isArrayOf(value.certifications, isCertification) &&
    isArrayOf(value.languages, isLanguage) &&
    isLocationPreferences(value.locationPreferences) &&
    isWorkAuthorization(value.workAuthorization)
  );
}

function isExperience(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNullableString(value.company) &&
    isNullableString(value.title) &&
    isNullableString(value.location) &&
    isNullableBoolean(value.isRemote) &&
    isNullableDate(value.startDate) &&
    isNullableDate(value.endDate) &&
    isStringArray(value.highlights) &&
    isStringArray(value.skills)
  );
}

function isEducation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNullableString(value.institution) &&
    isNullableString(value.degree) &&
    isNullableString(value.fieldOfStudy) &&
    isNullableDate(value.startDate) &&
    isNullableDate(value.endDate)
  );
}

function isCertification(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNullableString(value.name) &&
    isNullableString(value.issuer) &&
    isNullableDate(value.issuedDate)
  );
}

function isLanguage(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.language === "string" &&
    (value.proficiency === null ||
      [
        "native",
        "fluent",
        "professional",
        "intermediate",
        "basic",
        "other",
      ].includes(value.proficiency as string))
  );
}

function isLocationPreferences(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.currentLocation === null || isLocation(value.currentLocation)) &&
    isArrayOf(value.preferredLocations, isLocation) &&
    (value.remotePreference === null ||
      ["remote", "hybrid", "onsite", "flexible"].includes(
        value.remotePreference as string,
      )) &&
    isNullableBoolean(value.willingToRelocate)
  );
}

function isWorkAuthorization(value: unknown): boolean {
  return (
    isRecord(value) &&
    isStringArray(value.nationalities) &&
    isStringArray(value.authorizedCountries) &&
    isNullableBoolean(value.requiresVisaSponsorship) &&
    isNullableString(value.sourceText)
  );
}

function isNullableDate(value: unknown): boolean {
  return value === null || isDate(value);
}

function isDate(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.value === "string" &&
    ["year", "month", "day"].includes(value.precision as string)
  );
}

function isLocation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNullableString(value.city) &&
    isNullableString(value.stateOrRegion) &&
    isNullableString(value.country)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isNullableBoolean(value: unknown): boolean {
  return value === null || typeof value === "boolean";
}

function isArrayOf(value: unknown, predicate: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(predicate);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
