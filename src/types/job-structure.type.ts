/**
 * TODO: iterate more job descriptions and add other `description_text` section headers
 * For software engineering related jobs this is enough for now.
 */
export type JobSectionTypeType =
  | "overview"
  | "responsibilities"
  | "requirements"
  | "tech_stack"
  | "benefits"
  | "about_company"
  | "process"
  | "other";

/**
 * A bullet is a real <li>.
 * Everything else the ad renders is a <p>.
 */
export type JobBlockKindType = "paragraph" | "bullet";

export type JobBlockType = {
  kind: JobBlockKindType;
  text: string;
};

export type JobSectionType = {
  /** Null for the blocks that appear before the ad's first heading. */
  heading: string | null;
  sectionType: JobSectionTypeType;
  /** May be empty for a standalone heading or a parent before subsections. */
  blocks: JobBlockType[];
};

export type JobStructureType = {
  sections: JobSectionType[];
};
