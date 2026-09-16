import type { ChunkInputType, ChunkKindType } from "@/types/chunk.type.js";
import type {
  RestructResumeTextType,
  RestructTextEntryType,
} from "@/types/resume-extraction.type.js";

export const RESUME_CHUNKER_VERSION = "1.0.0";

/** restruct v1 section order, minus header_profile. */
const SECTION_ORDER = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "licenses",
  "tools_equipment",
  "languages",
  "volunteering",
  "awards",
  "publications",
  "references",
  "interests",
  "others",
] as const;

/**
 * Turns a restruct v1 resume into chunks, one per paragraph, bullet or skill
 * line. Titles, companies, dates and header_profile are not chunks.
 * @param document - Extracted resume.
 * @returns Chunks in document order.
 */
export function chunkResume(
  document: RestructResumeTextType,
): ChunkInputType[] {
  return SECTION_ORDER.flatMap((section) => {
    const path = `$.${section}`;

    switch (section) {
      case "summary":
        return (document.summary?.content ?? []).flatMap((item, index) =>
          item.type === "subheading"
            ? []
            : [
                toChunk(
                  section,
                  item.type,
                  item.text,
                  `${path}.content[${index}].text`,
                ),
              ],
        );

      case "education":
        return (document.education ?? []).flatMap((entry, entryIndex) => [
          ...chunkEntry(section, entry, `${path}[${entryIndex}]`),
          ...entry.skills.map((text, index) =>
            toChunk(
              section,
              "skill",
              text,
              `${path}[${entryIndex}].skills[${index}]`,
            ),
          ),
        ]);

      case "skills":
        return (document.skills ?? []).flatMap((group, groupIndex) =>
          chunkEntry(section, group, `${path}[${groupIndex}]`, "skill"),
        );

      case "others":
        return (document.others ?? []).flatMap((part, partIndex) =>
          part.entries.flatMap((entry, entryIndex) => {
            const entryPath = `${path}[${partIndex}].entries[${entryIndex}]`;

            return [
              ...entry.attributes.map((attribute, index) =>
                toChunk(
                  section,
                  "paragraph",
                  attribute.value,
                  `${entryPath}.attributes[${index}].value`,
                ),
              ),
              ...chunkEntry(section, entry, entryPath),
            ];
          }),
        );

      default:
        return (document[section] ?? []).flatMap((entry, entryIndex) =>
          chunkEntry(section, entry, `${path}[${entryIndex}]`),
        );
    }
  });
}

function chunkEntry(
  section: string,
  entry: RestructTextEntryType,
  entryPath: string,
  kind?: ChunkKindType,
): ChunkInputType[] {
  return [
    ...entry.paragraphs.map((text, index) =>
      toChunk(
        section,
        kind ?? "paragraph",
        text,
        `${entryPath}.paragraphs[${index}]`,
      ),
    ),
    ...entry.bullets.map((text, index) =>
      toChunk(
        section,
        kind ?? "bullet",
        text,
        `${entryPath}.bullets[${index}]`,
      ),
    ),
  ];
}

function toChunk(
  section: string,
  kind: ChunkKindType,
  text: string,
  sourcePath: string,
): ChunkInputType {
  // A newline inside restruct text is where the PDF wrapped a line.
  return { section, kind, text: text.replace(/\s*\n\s*/g, " "), sourcePath };
}
