import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";

import sectionConfig from "@/config/job-section.config.js";
import type {
  JobEmploymentTypeType,
  JobHeaderFactsType,
  JobWorkplaceTypeType,
} from "@/types/job-detail.type.js";
import type {
  JobBlockType,
  JobSectionType,
  JobSectionTypeType,
  JobStructureType,
} from "@/types/job-structure.type.js";

type ChildNodeType = DefaultTreeAdapterTypes.ChildNode;
type ElementType = DefaultTreeAdapterTypes.Element;
type ParentNodeType = DefaultTreeAdapterTypes.ParentNode;
type TextNodeType = DefaultTreeAdapterTypes.TextNode;

/**
 * @note currently this file is also handled mostly by AI Agent along with job-section.config.ts
 * I don't have enough resources to manually check and edit these parser logic
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

/**
 * Version of the parsing logic below. Structures are derived data, so a row
 * records which parser produced it and is re-parsed when this moves.
 */
export const JOB_STRUCTURE_PARSER_VERSION = "1.0.0";

/** Version of the shape `parseJobStructure` returns. */
export const JOB_STRUCTURE_SCHEMA_VERSION = "1.0.0";

/** Page chrome, never description content. See job-section.config.ts. */
const IGNORED_TAGS = new Set(["script", "style", "button", "svg", "noscript"]);

/** Elements that force a paragraph boundary, the way a browser lays them out. */
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "table",
  "tr",
  "blockquote",
]);

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * The flat stream the walk produces before anything is grouped.
 *
 * Splitting the walk from the grouping is what keeps this readable: the walk
 * knows about HTML and nothing about job ads, and the grouping knows about
 * job ads and nothing about HTML.
 */
type TokenType =
  | { kind: "text"; text: string }
  | { kind: "lineBreak" }
  | { kind: "blockBreak" }
  | { kind: "bullet"; text: string }
  | { kind: "heading"; text: string };

/** A block, plus whether the parser considers it a heading. */
type ClassifiedBlockType = JobBlockType & { isHeading: boolean };

/**
 * Parses stored description markup into labelled sections.
 *
 * Deterministic and offline: no model, no network, no browser. That is what
 * makes it safe to re-run over every stored description whenever the heading
 * vocabulary improves.
 * @param descriptionHtml - `job_details.description_html` as scraped.
 * @returns Sections in the order the ad presents them.
 */
export function parseJobStructure(descriptionHtml: string): JobStructureType {
  const tokens: TokenType[] = [];

  collectTokens(parseFragment(descriptionHtml), tokens);

  return { sections: groupIntoSections(foldIntoBlocks(tokens)) };
}

/**
 * Walks the parsed markup into a flat token stream.
 * @param node - Node whose children are being walked.
 * @param tokens - Stream being appended to.
 */
function collectTokens(node: ParentNodeType, tokens: TokenType[]): void {
  for (const child of node.childNodes) {
    if (isTextNode(child)) {
      // Newlines in the source are HTML whitespace, not line breaks. Only a
      // <br> ends a line, so they collapse here rather than surviving into
      // the block text and hiding a heading inside a wrapped run.
      tokens.push({ kind: "text", text: child.value.replace(/\s+/g, " ") });
      continue;
    }

    if (!isElement(child)) continue;

    const tagName = child.tagName.toLowerCase();

    if (IGNORED_TAGS.has(tagName)) continue;

    if (tagName === "br") {
      tokens.push({ kind: "lineBreak" });
      continue;
    }

    if (tagName === "ul" || tagName === "ol") {
      tokens.push({ kind: "blockBreak" });

      for (const item of child.childNodes) {
        if (!isElement(item) || item.tagName.toLowerCase() !== "li") continue;

        tokens.push({ kind: "bullet", text: readTextContent(item) });
      }

      tokens.push({ kind: "blockBreak" });
      continue;
    }

    if (HEADING_TAGS.has(tagName)) {
      tokens.push({ kind: "blockBreak" });
      tokens.push({ kind: "heading", text: readTextContent(child) });
      tokens.push({ kind: "blockBreak" });
      continue;
    }

    // Inline elements (span, strong, a, em) contribute their text to the
    // paragraph in progress, so they are walked without a boundary.
    if (BLOCK_TAGS.has(tagName)) tokens.push({ kind: "blockBreak" });

    collectTokens(child, tokens);

    if (BLOCK_TAGS.has(tagName)) tokens.push({ kind: "blockBreak" });
  }
}

/**
 * Folds the token stream into blocks.
 *
 * LinkedIn writes paragraphs as text runs separated by <br><br>, not as <p>
 * elements, so two consecutive line breaks are the real paragraph boundary.
 * @param tokens - Flat token stream from the walk.
 * @returns Blocks in document order, headings marked.
 */
function foldIntoBlocks(tokens: TokenType[]): ClassifiedBlockType[] {
  const blocks: ClassifiedBlockType[] = [];
  let pending: string[] = [];
  let lineBreakRun = 0;

  const flushParagraph = () => {
    const text = normalizeWhitespace(pending.join(""));

    pending = [];

    if (text && !isIgnoredBlockText(text)) {
      blocks.push({ kind: "paragraph", text, isHeading: false });
    }
  };

  for (const token of tokens) {
    if (token.kind === "text") {
      pending.push(token.text);
      lineBreakRun = 0;
      continue;
    }

    if (token.kind === "lineBreak") {
      lineBreakRun++;

      // The first break is a newline inside the paragraph; the second ends it.
      if (lineBreakRun === 1) pending.push("\n");
      else flushParagraph();

      continue;
    }

    lineBreakRun = 0;
    flushParagraph();

    if (token.kind === "bullet") {
      const text = normalizeWhitespace(token.text);

      if (text) blocks.push({ kind: "bullet", text, isHeading: false });

      continue;
    }

    if (token.kind === "heading") {
      const text = normalizeWhitespace(token.text);

      if (text) blocks.push({ kind: "paragraph", text, isHeading: true });
    }
  }

  flushParagraph();

  return markInferredHeadings(blocks);
}

/**
 * Marks the paragraphs that are acting as headings.
 *
 * Job ads almost never use <h*>: the fixture corpus writes "What You Will
 * Do" as a bare text run before a <ul>. A short, unpunctuated paragraph that
 * introduces a list — or that the vocabulary already recognises — is one.
 * @param blocks - Blocks in document order.
 * @returns The same blocks with headings marked.
 */
function markInferredHeadings(
  blocks: ClassifiedBlockType[],
): ClassifiedBlockType[] {
  return blocks.map((block, index) => {
    if (block.isHeading || block.kind !== "paragraph") return block;

    if (!isHeadingShaped(block.text)) return block;

    const introducesList = blocks[index + 1]?.kind === "bullet";
    const isKnown = classifyHeading(block.text) !== null;

    return { ...block, isHeading: introducesList || isKnown };
  });
}

/**
 * Whether a paragraph could be a heading on length and punctuation alone.
 * @param text - Paragraph text.
 * @returns Whether the shape allows it.
 */
function isHeadingShaped(text: string): boolean {
  if (text.length > sectionConfig.HEADING_MAX_CHARACTERS) return false;
  if (text.split(/\s+/).length > sectionConfig.HEADING_MAX_WORDS) return false;
  if (text.includes("\n")) return false;

  // A heading may end in a colon or a question mark, never a sentence stop.
  return !/[.;,!]$/.test(text);
}

/**
 * Groups blocks under the heading that introduced them.
 * @param blocks - Blocks in document order, headings marked.
 * @returns Sections, empty ones dropped.
 */
function groupIntoSections(blocks: ClassifiedBlockType[]): JobSectionType[] {
  const sections: JobSectionType[] = [];
  let current: JobSectionType | undefined;

  for (const block of blocks) {
    if (block.isHeading) {
      // LinkedIn's own "About the job" wrapper introduces the ad, not a
      // section of it, so it starts nothing.
      if (sectionConfig.IGNORED_HEADINGS.has(normalizeHeading(block.text))) {
        continue;
      }

      current = {
        heading: block.text,
        sectionType: classifyHeading(block.text) ?? "other",
        blocks: [],
      };

      sections.push(current);
      continue;
    }

    // Everything before the ad's first heading is its opening description.
    current ??= pushLeadingSection(sections);

    current.blocks.push({ kind: block.kind, text: block.text });
  }

  return sections.filter((section) => section.blocks.length > 0);
}

/**
 * Starts the unheaded section an ad opens with.
 * @param sections - Sections collected so far.
 * @returns The newly added leading section.
 */
function pushLeadingSection(sections: JobSectionType[]): JobSectionType {
  const leadingSection: JobSectionType = {
    heading: null,
    sectionType: "overview",
    blocks: [],
  };

  sections.push(leadingSection);

  return leadingSection;
}

/**
 * Looks a heading up in the mined vocabulary.
 * @param heading - Raw heading text.
 * @returns Section type, or null when the vocabulary does not know it.
 */
function classifyHeading(heading: string): JobSectionTypeType | null {
  const normalized = normalizeHeading(heading);

  // hasOwn, not a bare lookup: a heading of "constructor" or "toString"
  // would otherwise resolve against Object.prototype and return a function.
  if (Object.hasOwn(sectionConfig.SECTION_TYPE_BY_HEADING, normalized)) {
    return sectionConfig.SECTION_TYPE_BY_HEADING[normalized];
  }

  for (const [
    prefix,
    sectionType,
  ] of sectionConfig.SECTION_TYPE_BY_HEADING_PREFIX) {
    if (normalized.startsWith(prefix)) return sectionType;
  }

  return null;
}

/**
 * Reduces a heading to its vocabulary key.
 * @param heading - Raw heading text.
 * @returns Lowercased heading without decoration.
 */
function normalizeHeading(heading: string): string {
  return normalizeWhitespace(heading)
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/^[\s*•\-–—]+/, "")
    .replace(/[\s:?!.]+$/, "");
}

/**
 * @param text - Raw text from the markup.
 * @returns Text with runs of spaces collapsed and edges trimmed.
 */
function normalizeWhitespace(text: string): string {
  return text
    .replaceAll(" ", " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * @param text - Candidate block text.
 * @returns Whether it is a LinkedIn control rather than ad content.
 */
function isIgnoredBlockText(text: string): boolean {
  return sectionConfig.IGNORED_BLOCK_TEXTS.has(text.toLowerCase());
}

/**
 * Reads all descendant text of one element.
 * @param node - Element to read.
 * @returns Concatenated text of the subtree.
 */
function readTextContent(node: ParentNodeType): string {
  let text = "";

  for (const child of node.childNodes) {
    if (isTextNode(child)) text += child.value.replace(/\s+/g, " ");
    else if (isElement(child) && !IGNORED_TAGS.has(child.tagName.toLowerCase()))
      text += readTextContent(child);
  }

  return text;
}

function isElement(node: ChildNodeType): node is ElementType {
  return "tagName" in node;
}

function isTextNode(node: ChildNodeType): node is TextNodeType {
  return node.nodeName === "#text";
}
