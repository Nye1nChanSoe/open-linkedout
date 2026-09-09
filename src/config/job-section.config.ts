import type { JobSectionTypeType } from "@/types/job-structure.type.js";

/**
 * Heading vocabulary, mined from the `91-description corpus` NOT invented
 * Counts in the comments are how many of those ads used the wording
 * which is the only evidence available for what to add next.
 *
 * Keys are normalized headings: lowercased, straight apostrophes,
 * no trailing punctuation. See `normalizeHeading` in the parser.
 *
 * "Chrome" throughout means the UI a page draws around its content -
 * toolbars, buttons, labels - as opposed to the content itself. Google
 * Chrome is named after it. Here it means LinkedIn's own furniture inside
 * the description slot ("About the job", "... more", the benefits panel),
 * as opposed to what the employer wrote. `description_html` is the whole
 * slot, so the parser has to drop the chrome itself.
 *
 * @note We should let this section configs AI generated since they can analyze huge amount of corupus
 */
const config = {
  SECTION_TYPE_BY_HEADING: {
    // Overview (24 across the corpus).
    "job description": "overview", // 12
    "role overview": "overview", // 5
    "about the role": "overview", // 4
    "about this role": "overview", // LiveKit, job 86
    "job summary": "overview", // 3
    summary: "overview", // 2
    "the opportunity": "overview", // 3
    "position summary": "overview",
    "the role": "overview",

    // Responsibilities (57).
    responsibilities: "responsibilities", // 22
    "key responsibilities": "responsibilities", // 16
    "job responsibilities": "responsibilities", // 6
    "role responsibilities": "responsibilities", // 3
    "what you'll do": "responsibilities", // 9 across both apostrophes
    "what you will do": "responsibilities",
    "in this role, you'll get to": "responsibilities", // 2
    "in this role you'll get to": "responsibilities",
    "duties and responsibilities": "responsibilities",
    "your impact": "responsibilities",

    // Requirements (70).
    requirements: "requirements", // 21
    requirement: "requirements", // 2
    "job requirements": "requirements", // 6
    qualifications: "requirements", // 14
    "preferred qualifications": "requirements", // 6
    "required qualifications": "requirements", // 2
    "minimum qualifications": "requirements",
    "basic qualifications": "requirements",
    "nice to have": "requirements", // 8
    "nice to haves": "requirements",
    "good to have": "requirements",
    "extra points": "requirements", // 2
    "bonus points": "requirements",
    "what we are looking for": "requirements", // 3
    "what we're looking for": "requirements", // 2
    "who you are": "requirements",
    "about you": "requirements", // Amaris and SearchApi, jobs 16, 88, 105
    "must have": "requirements", // Jobs 87, 108, 120, 122
    "what you'll bring": "requirements", // 2
    "what you'll need to succeed": "requirements", // 2
    "it's great if you have": "requirements", // 2
    "education & experience": "requirements", // 3
    "education and experience": "requirements",
    experience: "requirements", // 2
    "required skills": "requirements", // 2
    "preferred skills": "requirements", // 2
    "skills and experience": "requirements",

    /**
     * LinkedIn's own skill panel, not the employer's prose. It is the most
     * explicit requirement list on the page, so it is kept rather than
     * treated as page chrome.
     */
    "requirements added by the job poster": "requirements", // 9

    // Tech stack.
    "tech stack": "tech_stack",
    "technology stack": "tech_stack",
    "our tech stack": "tech_stack",
    "technologies you'll use": "tech_stack",
    "tools & technologies": "tech_stack",
    "tools and technologies": "tech_stack",

    // Benefits (20).
    benefits: "benefits", // 4
    "benefits and perks": "benefits", // 2
    "benefits & perks": "benefits",
    perks: "benefits",
    "perks and benefits": "benefits",
    "what we offer": "benefits", // 2
    "what's in it for you": "benefits",
    "why join us": "benefits",
    compensation: "benefits",
    "compensation and benefits": "benefits",

    /** LinkedIn's parsed benefits panel. */
    "benefits found in job post": "benefits", // 5

    // About the company (14).
    "about us": "about_company", // 3
    "who we are": "about_company", // 5
    "company overview": "about_company", // 2
    "about the company": "about_company",
    "get to know our team": "about_company", // 2
    "our mission": "about_company",
    "our team": "about_company",

    // Hiring process (6).
    "application process": "process", // 3
    "interview process": "process",
    "hiring process": "process",
    "selection process": "process", // TikTok, job 13; bare heading before prose
    "recruitment process": "process",
    "how to apply": "process",
    "next steps": "process",
    "who may apply": "process", // 2

    // Explicitly uninteresting, so they are not mistaken for content.
    disclaimer: "other", // 2
    "equal opportunity employer": "other", // 4
    "eeo statement": "other",
  } as Record<string, JobSectionTypeType>,

  /**
   * Last resort, after the exact table and the prefixes. Headings are a Zipf
   * tail — in 70 jobs almost every unmatched wording appeared exactly once —
   * so the only thing that scales is matching the word that carries the
   * meaning. Measured to classify 51 of 100 previously unknown sections.
   *
   * Order matters: the first match wins.
   */
  SECTION_TYPE_BY_HEADING_KEYWORD: [
    [/disclaimer|equal opportunity|eeo\b|privacy/, "other"],
    [/benefit|perks|compensation|comp and|salary|\bpay\b|receive from us|rewards/, "benefits"],
    [/process|timeline|how to apply|next steps|interview/, "process"],
    [
      /responsibilit|duties|deliverables|what you.?ll (do|own|work on)|your impact|make an impact|role entails|outcome/,
      "responsibilities",
    ],
    [
      /qualification|requirement|skills|experience|expertise|nice to have|bonus if|good to have|your profile|looking for|look to you for|set you up for success/,
      "requirements",
    ],
  ] as [RegExp, JobSectionTypeType][],

  /**
   * Company-specific headings ("About Agoda", "Why Binance") are endless, so
   * they are matched by prefix once the exact table misses.
   */
  SECTION_TYPE_BY_HEADING_PREFIX: [
    ["about ", "about_company"],
    ["why ", "about_company"],
    ["life at ", "about_company"],
    ["working at ", "about_company"],
  ] as [string, JobSectionTypeType][],

  /**
   * Page chrome. Dropped rather than classified: it is the page, not the ad.
   */
  IGNORED_HEADINGS: new Set(["about the job"]),
  IGNORED_BLOCK_TEXTS: new Set(["… more", "...more", "… less", "see more"]),

  /** A heading is short, unpunctuated, and introduces what follows. */
  HEADING_MAX_WORDS: 8,
  HEADING_MAX_CHARACTERS: 60,
} as const;

export default config;
