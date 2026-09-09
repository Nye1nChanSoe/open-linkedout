import { parseJobStructure } from "@/app/parsers/job-detail-structure-parser.js";
import { createDatabaseConnection } from "@database/connection.js";

/**
 * Tuning script for checking description_html parsing accuracy
 */
const database = createDatabaseConnection();
const rows = database
  .prepare(
    `SELECT d.job_id, d.description_html, j.title
     FROM job_details d
     JOIN jobs j ON j.id = d.job_id
     WHERE d.description_html IS NOT NULL AND length(d.description_html) > 0`,
  )
  .all() as { job_id: number; description_html: string; title: string }[];

console.log(`${rows.length} descriptions with markup\n`);

const typeCounts: Record<string, number> = {};
const unknownHeadings: Record<string, number> = {};
let noHeadingCount = 0;

for (const [index, row] of rows.entries()) {
  const { sections } = parseJobStructure(row.description_html, row.title);

  // A single section can have a valid heading; this measures heading presence,
  // not parsing accuracy or whether the source ought to have more sections.
  if (!sections.some((section) => section.heading !== null)) noHeadingCount++;

  for (const section of sections) {
    typeCounts[section.sectionType] =
      (typeCounts[section.sectionType] ?? 0) + 1;

    if (section.sectionType === "other" && section.heading) {
      unknownHeadings[section.heading] =
        (unknownHeadings[section.heading] ?? 0) + 1;
    }
  }

  if (process.argv[2] === "--dump" && index < 3) {
    console.log(`--- job ${row.job_id}`);

    for (const section of sections) {
      const bullets = section.blocks.filter((b) => b.kind === "bullet").length;

      console.log(
        `  [${section.sectionType}] ${JSON.stringify(section.heading)} ` +
          `(${section.blocks.length - bullets}p ${bullets}b)`,
      );
    }
  }
}

console.log("\nsections by type:", typeCounts);
console.log(`jobs with no heading found: ${noHeadingCount} / ${rows.length}`);
console.log("\nunclassified headings, most common first:");

for (const [heading, count] of Object.entries(unknownHeadings)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40)) {
  console.log(`${String(count).padStart(3)}  ${heading}`);
}

database.close();
