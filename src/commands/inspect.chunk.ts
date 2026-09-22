import pc from "picocolors";

import { createDatabaseConnection } from "@database/connection.js";

/**
 * @dev quick script to check chunked record and its closest neighbour default to 5
 * 
 *
 * Prints one chunk, its vector's provenance, and its nearest neighbours.
 *
 * Usage: npm run inspect:chunk -- <chunkId> [neighbours]
 */
const chunkId = Number(process.argv[2]);
const neighbourCount = Number(process.argv[3]) || 5;

if (!Number.isInteger(chunkId)) {
  console.error("Usage: npm run inspect:chunk -- <chunkId> [neighbours]");
  process.exit(1);
}

const database = createDatabaseConnection();

const chunk = database
  .prepare(
    `
    SELECT c.*, e.embedding_profile, e.dim, e.embedded_at
    FROM chunks c
    LEFT JOIN chunk_embeddings e ON e.chunk_id = c.id
    WHERE c.id = @chunk_id;
  `,
  )
  .get({ chunk_id: chunkId }) as
  | {
      id: number;
      owner_kind: "job" | "resume";
      owner_id: number;
      section: string;
      kind: string;
      text: string;
      text_hash: string;
      source_path: string;
      chunker_version: string;
      embedding_profile: string | null;
      dim: number | null;
      embedded_at: string | null;
    }
  | undefined;

if (!chunk) {
  console.error(`Chunk ${chunkId} was not found.`);
  database.close();
  process.exit(1);
}

console.info(
  pc.blueBright(`chunk ${chunk.id}`),
  pc.cyan(`${chunk.owner_kind} ${chunk.owner_id}`),
  pc.dim("|"),
  pc.cyan(`${chunk.section}/${chunk.kind}`),
  pc.dim(`| ${chunk.source_path} | chunker ${chunk.chunker_version}`),
);
console.info(chunk.text);
console.info(pc.dim(`text_hash ${chunk.text_hash}`));

if (!chunk.embedding_profile) {
  console.warn(pc.yellow("\nNo vector yet."));
  database.close();
  process.exit(0);
}

const vector = database
  .prepare(`SELECT embedding FROM vec_chunks WHERE chunk_id = @chunk_id;`)
  .get({ chunk_id: chunkId }) as { embedding: Buffer } | undefined;

if (!vector) {
  console.warn(
    pc.yellow("\nMetadata says embedded, but vec_chunks has no row."),
  );
  database.close();
  process.exit(1);
}

const values = new Float32Array(new Uint8Array(vector.embedding).buffer);
const norm = Math.hypot(...values);

console.info(
  pc.blueBright("\nvector:"),
  pc.cyan(`${chunk.dim} dims`),
  pc.dim("|"),
  pc.cyan(`norm ${norm.toFixed(6)}`),
  pc.dim(`| ${chunk.embedding_profile} | embedded ${chunk.embedded_at}`),
);
console.info(
  pc.dim(
    `first 6: [${[...values.slice(0, 6)].map((v) => v.toFixed(6)).join(", ")}]`,
  ),
);

// One more than asked for: the chunk itself is always its own nearest hit.
const neighbours = database
  .prepare(
    `
    WITH hits AS (
      SELECT chunk_id, distance
      FROM vec_chunks
      WHERE embedding MATCH @embedding
        AND k = @k
        AND owner_kind = @owner_kind
    )
    SELECT c.id, c.owner_id, c.section, c.text, hits.distance
    FROM hits
    JOIN chunks c ON c.id = hits.chunk_id
    JOIN chunk_embeddings e
      ON e.chunk_id = c.id AND e.embedding_profile = @embedding_profile
    WHERE c.id != @chunk_id
    ORDER BY hits.distance;
  `,
  )
  .all({
    embedding: vector.embedding,
    k: neighbourCount + 1,
    owner_kind: chunk.owner_kind,
    embedding_profile: chunk.embedding_profile,
    chunk_id: chunkId,
  }) as {
  id: number;
  owner_id: number;
  section: string;
  text: string;
  distance: number;
}[];

console.info(
  pc.blueBright(`\nnearest ${chunk.owner_kind} chunks:`),
  pc.dim("(similarity = 1 - cosine distance)"),
);

for (const neighbour of neighbours) {
  console.info(
    pc.cyan((1 - neighbour.distance).toFixed(3)),
    pc.dim(
      `chunk ${neighbour.id} | ${chunk.owner_kind} ${neighbour.owner_id} | ${neighbour.section}`,
    ),
  );
  console.info(`   ${neighbour.text.slice(0, 110)}`);
}

database.close();
