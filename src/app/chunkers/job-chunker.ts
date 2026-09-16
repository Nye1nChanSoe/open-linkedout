import { TYPED_BULLET_MARKER } from "@/app/parsers/job-detail-structure-parser.js";
import chunkerConfig from "@/config/chunker.config.js";
import type { ChunkInputType } from "@/types/chunk.type.js";
import type {
  JobBlockType,
  JobSectionType,
  JobStructureType,
} from "@/types/job-structure.type.js";

export const JOB_CHUNKER_VERSION = "1.0.0";

const SENTENCE_END = /[.!?:;)]$/;
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z0-9"“(])/;

/**
 * Turns a parsed job description into chunks. Headings are not chunks;
 * they label the chunks under them through `section`.
 * @param structure - Parsed job description.
 * @returns Chunks in document order.
 */
export function chunkJobStructure(
  structure: JobStructureType,
): ChunkInputType[] {
  return structure.sections.flatMap((section, sectionIndex) =>
    chunkSection(section, `$.sections[${sectionIndex}].blocks`),
  );
}

function chunkSection(
  section: JobSectionType,
  blocksPath: string,
): ChunkInputType[] {
  const chunks: ChunkInputType[] = [];
  const { blocks } = section;
  let start = 0;

  while (start < blocks.length) {
    const block = blocks[start];

    if (block.text.includes("\n")) {
      chunks.push(...splitLines(section, block, `${blocksPath}[${start}]`));
      start++;
      continue;
    }

    let end = start;

    while (continuesInNext(blocks[end], blocks[end + 1])) end++;

    const text = blocks
      .slice(start, end + 1)
      .map((b) => b.text)
      .join(" ");
    const path =
      end === start
        ? `${blocksPath}[${start}]`
        : `${blocksPath}[${start}:${end + 1}]`;

    chunks.push(...splitLong(section, block.kind, text, path));
    start = end + 1;
  }

  return chunks;
}

/**
 *  A paragraph that stops mid-sentence and a next one that starts lowercase are one sentence.
 */
function continuesInNext(
  block: JobBlockType,
  next: JobBlockType | undefined,
): boolean {
  return (
    next !== undefined &&
    block.kind === "paragraph" &&
    next.kind === "paragraph" &&
    !next.text.includes("\n") &&
    !SENTENCE_END.test(block.text) &&
    /^[a-z]/.test(next.text)
  );
}

function splitLines(
  section: JobSectionType,
  block: JobBlockType,
  blockPath: string,
): ChunkInputType[] {
  return block.text
    .split("\n")
    .map((line) => line.trim())
    .flatMap((line, lineIndex) => {
      if (!line) return [];

      const isBullet = TYPED_BULLET_MARKER.test(line);

      return splitLong(
        section,
        isBullet ? "bullet" : block.kind,
        isBullet ? line.replace(TYPED_BULLET_MARKER, "") : line,
        `${blockPath}.lines[${lineIndex}]`,
      );
    });
}

/**
 * Packs sentences greedily up to the ceiling; one sentence over it stays whole.
 */
function splitLong(
  section: JobSectionType,
  kind: JobBlockType["kind"],
  text: string,
  path: string,
): ChunkInputType[] {
  const toChunk = (chunkText: string, sourcePath: string): ChunkInputType => ({
    section: section.sectionType,
    kind,
    text: chunkText,
    sourcePath,
  });

  if (text.length <= chunkerConfig.MAX_CHUNK_CHARS)
    return [toChunk(text, path)];

  const sentences = text.split(SENTENCE_BOUNDARY);
  const chunks: ChunkInputType[] = [];
  let first = 0;

  for (let i = 1; i <= sentences.length; i++) {
    const packed = sentences.slice(first, i + 1).join(" ");

    if (
      i === sentences.length ||
      packed.length > chunkerConfig.MAX_CHUNK_CHARS
    ) {
      chunks.push(
        toChunk(
          sentences.slice(first, i).join(" "),
          `${path}.sentences[${first}:${i}]`,
        ),
      );
      first = i;
    }
  }

  return chunks;
}
