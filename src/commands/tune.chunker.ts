import { chunkJobStructure } from "@/app/chunkers/job-chunker.js";
import { chunkResume } from "@/app/chunkers/resume-chunker.js";
import chunkerConfig from "@/config/chunker.config.js";
import type { ChunkInputType, ChunkOwnerKindType } from "@/types/chunk.type.js";
import type { JobStructureType } from "@/types/job-structure.type.js";
import type { RestructResumeTextType } from "@/types/resume-extraction.type.js";
import { createDatabaseConnection } from "@database/connection.js";

/**
 * Tuning script for job and resume chunking. Fails when a document's chunks
 * do not carry all of its text, or two chunks share a source path.
 *
 * Usage: tsx src/commands/tune.chunker.ts [--dump job|resume <id>]
 */
type ChunkedDocumentType = {
  id: number;
  sourceText: string;
  chunks: ChunkInputType[];
};

/** Resume fields holding prose. Titles, dates, urls and header_profile are context. */
const RESUME_PROSE_KEYS = new Set(["paragraphs", "bullets", "skills"]);

const database = createDatabaseConnection();

const dump =
  process.argv[2] === "--dump"
    ? { ownerKind: process.argv[3], id: Number(process.argv[4]) }
    : undefined;

const jobRows = database
  .prepare(`SELECT job_id, structure_json FROM job_structures ORDER BY job_id`)
  .all() as { job_id: number; structure_json: string }[];

const resumeRows = database
  .prepare(
    `SELECT resume_id, resume_json FROM resume_extractions ORDER BY resume_id`,
  )
  .all() as { resume_id: number; resume_json: string }[];

const jobsFailed = report(
  "job",
  jobRows.map((row) => {
    const structure: JobStructureType = JSON.parse(row.structure_json);

    return {
      id: row.job_id,
      sourceText: structure.sections
        .flatMap((section) => section.blocks.map((block) => block.text))
        .join(""),
      chunks: chunkJobStructure(structure),
    };
  }),
);

const resumesFailed = report(
  "resume",
  resumeRows.map((row) => {
    const document: RestructResumeTextType = JSON.parse(row.resume_json);

    return {
      id: row.resume_id,
      sourceText: resumeProse(document).join(""),
      chunks: chunkResume(document),
    };
  }),
);

if (jobsFailed || resumesFailed) process.exitCode = 1;

database.close();

/**
 * Prints the counts and checks for one owner kind.
 * @returns Whether any document failed a check.
 */
function report(
  ownerKind: ChunkOwnerKindType,
  documents: ChunkedDocumentType[],
): boolean {
  const kindCounts: Record<string, number> = {};
  const sectionCounts: Record<string, number> = {};
  const shapeCounts: Record<string, number> = {};
  const lengths: number[] = [];
  const lostTextIds: number[] = [];
  const duplicatePathIds: number[] = [];

  for (const { id, sourceText, chunks } of documents) {
    if (compact(sourceText) !== compact(chunks.map((c) => c.text).join(""))) {
      lostTextIds.push(id);
    }

    if (new Set(chunks.map((c) => c.sourcePath)).size !== chunks.length) {
      duplicatePathIds.push(id);
    }

    for (const chunk of chunks) {
      const shape = shapeOf(chunk.sourcePath);

      kindCounts[chunk.kind] = (kindCounts[chunk.kind] ?? 0) + 1;
      sectionCounts[chunk.section] = (sectionCounts[chunk.section] ?? 0) + 1;
      shapeCounts[shape] = (shapeCounts[shape] ?? 0) + 1;
      lengths.push(chunk.text.length);
    }

    if (dump?.ownerKind === ownerKind && dump.id === id) {
      console.log(`--- ${ownerKind} ${id}`);

      for (const chunk of chunks) {
        console.log(
          `  ${chunk.sourcePath} [${chunk.section}/${chunk.kind}] ${chunk.text}`,
        );
      }

      console.log();
    }
  }

  lengths.sort((a, b) => a - b);

  const percentile = (p: number) =>
    lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * p))];
  const overCeiling = lengths.filter(
    (length) => length > chunkerConfig.MAX_CHUNK_CHARS,
  ).length;

  console.log(
    `=== ${ownerKind}: ${documents.length} documents, ${lengths.length} chunks\n`,
  );
  console.log("chunks by kind:", kindCounts);
  console.log("chunks by section:", sectionCounts);
  console.log("chunks by shape:", shapeCounts);
  console.log(
    `\nlength in chars: p50 ${percentile(0.5)}, p90 ${percentile(0.9)}, ` +
      `p99 ${percentile(0.99)}, max ${lengths.at(-1)}`,
  );
  console.log(
    `over the ${chunkerConfig.MAX_CHUNK_CHARS}-char ceiling: ${overCeiling}`,
  );
  console.log(
    `\n${ownerKind}s with duplicate source paths: ${duplicatePathIds.length}`,
    duplicatePathIds,
  );
  console.log(
    `${ownerKind}s whose chunks lost text: ${lostTextIds.length}`,
    lostTextIds,
    "\n",
  );

  return lostTextIds.length > 0 || duplicatePathIds.length > 0;
}

/**
 * Every prose string in a resume, read from the document rather than from the
 * chunker, so a chunker that skips a field is caught.
 */
function resumeProse(document: RestructResumeTextType): string[] {
  const prose: string[] = [];

  for (const item of document.summary?.content ?? []) {
    if (item.type !== "subheading") prose.push(item.text);
  }

  for (const part of document.others ?? []) {
    for (const entry of part.entries) {
      prose.push(...entry.attributes.map((attribute) => attribute.value));
    }
  }

  const walk = (value: unknown, key: string) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          if (RESUME_PROSE_KEYS.has(key)) prose.push(item);
        } else {
          walk(item, key);
        }
      }
    } else if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value)) {
        walk(child, childKey);
      }
    }
  };

  const { summary: _summary, ...sections } = document;

  walk({ ...sections, header_profile: null }, "");

  return prose;
}

/** Typed bullet markers are stripped by the parser and chunker, so they are not compared. */
function compact(text: string): string {
  return text.replace(/[\s•*-]+/g, "");
}

function shapeOf(sourcePath: string): string {
  if (sourcePath.includes(".sentences[")) return "sentences";
  if (sourcePath.includes(".lines[")) return "lines";
  if (/\[\d+:\d+\]$/.test(sourcePath)) return "joined";

  return "one block";
}
