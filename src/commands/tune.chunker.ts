import { chunkJobStructure } from "@/app/chunkers/job-chunker.js";
import chunkerConfig from "@/config/chunker.config.js";
import type { JobStructureType } from "@/types/job-structure.type.js";
import { createDatabaseConnection } from "@database/connection.js";

/**
 * Tuning script for job chunking. Fails when a job's chunks do not carry
 * all of its structure's text.
 *
 * Usage: tsx src/commands/tune.chunker.ts [--dump <jobId>]
 */
const database = createDatabaseConnection();
const rows = database
  .prepare(`SELECT job_id, structure_json FROM job_structures ORDER BY job_id`)
  .all() as { job_id: number; structure_json: string }[];

const dumpJobId =
  process.argv[2] === "--dump" ? Number(process.argv[3]) : undefined;

const kindCounts: Record<string, number> = {};
const sectionCounts: Record<string, number> = {};
const shapeCounts: Record<string, number> = {};
const lengths: number[] = [];
const lostTextJobIds: number[] = [];
const duplicatePathJobIds: number[] = [];

for (const row of rows) {
  const structure: JobStructureType = JSON.parse(row.structure_json);
  const chunks = chunkJobStructure(structure);

  const sourceText = structure.sections
    .flatMap((section) => section.blocks.map((block) => block.text))
    .join("");

  if (compact(sourceText) !== compact(chunks.map((c) => c.text).join(""))) {
    lostTextJobIds.push(row.job_id);
  }

  if (new Set(chunks.map((c) => c.sourcePath)).size !== chunks.length) {
    duplicatePathJobIds.push(row.job_id);
  }

  for (const chunk of chunks) {
    kindCounts[chunk.kind] = (kindCounts[chunk.kind] ?? 0) + 1;
    sectionCounts[chunk.section] = (sectionCounts[chunk.section] ?? 0) + 1;
    shapeCounts[shapeOf(chunk.sourcePath)] =
      (shapeCounts[shapeOf(chunk.sourcePath)] ?? 0) + 1;
    lengths.push(chunk.text.length);
  }

  if (row.job_id === dumpJobId) {
    console.log(`--- job ${row.job_id}`);

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

console.log(`${rows.length} job structures, ${lengths.length} chunks\n`);
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
  `\njobs with duplicate source paths: ${duplicatePathJobIds.length}`,
  duplicatePathJobIds,
);
console.log(
  `jobs whose chunks lost text: ${lostTextJobIds.length}`,
  lostTextJobIds,
);

if (lostTextJobIds.length > 0 || duplicatePathJobIds.length > 0) {
  process.exitCode = 1;
}

database.close();

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
