/**
 * V1 structured profile inferred from one resume's normalized text.
 *
 * Include only information explicitly supported by the resume. Use null for
 * unavailable scalar values and empty arrays for unavailable lists.
 */
export type LLMResumeInferenceType = {
  headline: string | null;
  targetRoles: string[];
  skills: string[];
  experience: LLMResumeExperienceType[];
  education: LLMResumeEducationType[];
  certifications: LLMResumeCertificationType[];
  languages: LLMResumeLanguageType[];
  locationPreferences: LLMResumeLocationPreferencesType;
  workAuthorization: LLMResumeWorkAuthorizationType;
};

export type LLMResumeExperienceType = {
  company: string | null;
  title: string | null;
  location: string | null;
  isRemote: boolean | null;
  startDate: LLMResumeDateType | null;
  endDate: LLMResumeDateType | null;
  highlights: string[];
  skills: string[];
};

export type LLMResumeEducationType = {
  institution: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: LLMResumeDateType | null;
  endDate: LLMResumeDateType | null;
};

export type LLMResumeCertificationType = {
  name: string | null;
  issuer: string | null;
  issuedDate: LLMResumeDateType | null;
};

export type LLMResumeLanguageType = {
  language: string;
  proficiency:
    | "native"
    | "fluent"
    | "professional"
    | "intermediate"
    | "basic"
    | "other"
    | null;
};

export type LLMResumeLocationPreferencesType = {
  currentLocation: LLMResumeLocationType | null;
  preferredLocations: LLMResumeLocationType[];
  remotePreference: "remote" | "hybrid" | "onsite" | "flexible" | null;
  willingToRelocate: boolean | null;
};

export type LLMResumeLocationType = {
  city: string | null;
  stateOrRegion: string | null;
  country: string | null;
};

export type LLMResumeWorkAuthorizationType = {
  nationalities: string[];
  authorizedCountries: string[];
  requiresVisaSponsorship: boolean | null;
  sourceText: string | null;
};

export type LLMResumeDateType = {
  value: string;
  precision: "year" | "month" | "day";
};
