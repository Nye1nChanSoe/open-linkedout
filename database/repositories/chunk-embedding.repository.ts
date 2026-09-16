import type BetterSqlite3 from "better-sqlite3";

import type { ChunkOwnerKindType } from "@/types/chunk.type.js";
import type { DatabaseConnectionType } from "@/types/database.type.js";
import type {
  ChunkEmbeddingInputType,
  ChunkNeedingEmbeddingType,
  ChunkSearchHitType,
} from "@/types/embedding.type.js";

export class ChunkEmbeddingRepository {
  private readonly deleteVectorStatement: BetterSqlite3.Statement<
    [{ chunk_id: number }]
  >;

  private readonly insertVectorStatement: BetterSqlite3.Statement<
    [{ chunk_id: number; owner_kind: ChunkOwnerKindType; embedding: Buffer }]
  >;

  private readonly upsertEmbeddingStatement: BetterSqlite3.Statement<
    [
      {
        chunk_id: number;
        embedding_profile: string;
        dim: number;
        embedded_at: string;
      },
    ]
  >;

  private readonly listChunksNeedingEmbeddingStatement: BetterSqlite3.Statement<
    [{ embedding_profile: string; limit: number }],
    ChunkNeedingEmbeddingType
  >;

  private readonly deleteOrphanVectorsStatement: BetterSqlite3.Statement<[]>;

  private readonly searchStatement: BetterSqlite3.Statement<
    [
      {
        embedding: Buffer;
        owner_kind: ChunkOwnerKindType;
        k: number;
        embedding_profile: string;
      },
    ],
    ChunkSearchHitType
  >;

  private readonly upsertManyTransaction: (
    rows: ChunkEmbeddingInputType[],
    profileId: string,
  ) => void;

  constructor(private readonly database: DatabaseConnectionType) {
    this.deleteVectorStatement = database.prepare(
      `DELETE FROM vec_chunks WHERE chunk_id = @chunk_id;`,
    );

    // vec0 rejects a float-bound primary key, and has no upsert.
    this.insertVectorStatement = database.prepare(
      `
      INSERT INTO vec_chunks (chunk_id, owner_kind, embedding)
      VALUES (CAST(@chunk_id AS INTEGER), @owner_kind, @embedding);
    `,
    );

    this.upsertEmbeddingStatement = database.prepare(
      `
      INSERT INTO chunk_embeddings (chunk_id, embedding_profile, dim, embedded_at)
      VALUES (@chunk_id, @embedding_profile, @dim, @embedded_at)
      ON CONFLICT (chunk_id) DO UPDATE SET
        embedding_profile = excluded.embedding_profile,
        dim = excluded.dim,
        embedded_at = excluded.embedded_at;
    `,
    );

    this.listChunksNeedingEmbeddingStatement = database.prepare(
      `
      SELECT c.id, c.owner_kind, c.text, c.text_hash
      FROM chunks c
      LEFT JOIN chunk_embeddings e ON e.chunk_id = c.id
      WHERE e.chunk_id IS NULL OR e.embedding_profile != @embedding_profile
      ORDER BY c.id
      LIMIT @limit;
    `,
    );

    this.deleteOrphanVectorsStatement = database.prepare(
      `
      DELETE FROM vec_chunks
      WHERE chunk_id NOT IN (SELECT id FROM chunks);
    `,
    );

    // Vectors from another profile are not comparable with the query, so a
    // stale one is dropped even if that returns fewer than k hits.
    this.searchStatement = database.prepare(
      `
      WITH hits AS (
        SELECT chunk_id, distance
        FROM vec_chunks
        WHERE embedding MATCH @embedding
          AND k = @k
          AND owner_kind = @owner_kind
      )
      SELECT
        c.id AS chunk_id,
        c.owner_id,
        c.section,
        c.kind,
        c.text,
        c.source_path,
        hits.distance
      FROM hits
      JOIN chunks c ON c.id = hits.chunk_id
      JOIN chunk_embeddings e
        ON e.chunk_id = c.id AND e.embedding_profile = @embedding_profile
      ORDER BY hits.distance;
    `,
    );

    this.upsertManyTransaction = database.transaction(
      (rows: ChunkEmbeddingInputType[], profileId: string) => {
        const embeddedAt = new Date().toISOString();

        for (const row of rows) {
          this.deleteVectorStatement.run({ chunk_id: row.chunkId });
          this.insertVectorStatement.run({
            chunk_id: row.chunkId,
            owner_kind: row.ownerKind,
            embedding: toBlob(row.vector),
          });
          this.upsertEmbeddingStatement.run({
            chunk_id: row.chunkId,
            embedding_profile: profileId,
            dim: row.vector.length,
            embedded_at: embeddedAt,
          });
        }
      },
    );
  }

  /**
   * Stores vectors and the profile that produced them, replacing older ones.
   * @param rows - One vector per chunk.
   * @param profileId - Embedding profile identifier.
   */
  upsertMany(rows: ChunkEmbeddingInputType[], profileId: string): void {
    this.upsertManyTransaction(rows, profileId);
  }

  /**
   * Lists chunks with no vector, or one from another profile.
   * @param profileId - Profile the caller considers current.
   * @param limit - Maximum rows to return.
   * @returns Chunks to embed, oldest first.
   */
  listChunksNeedingEmbedding(
    profileId: string,
    limit: number,
  ): ChunkNeedingEmbeddingType[] {
    return this.listChunksNeedingEmbeddingStatement.all({
      embedding_profile: profileId,
      limit,
    });
  }

  /**
   * Removes vectors whose chunk no longer exists. The delete trigger should
   * leave nothing to remove; this is the check that it did.
   * @returns Number of vectors removed.
   */
  deleteOrphanVectors(): number {
    return this.deleteOrphanVectorsStatement.run().changes;
  }

  /**
   * Nearest chunks to a vector, within one owner kind and one profile.
   * @param vector - Query vector.
   * @param profileId - Profile that produced the query vector.
   * @param ownerKind - Search jobs or resumes.
   * @param k - Maximum number of hits.
   * @returns Hits by ascending cosine distance.
   */
  search(
    vector: Float32Array,
    profileId: string,
    ownerKind: ChunkOwnerKindType,
    k: number,
  ): ChunkSearchHitType[] {
    return this.searchStatement.all({
      embedding: toBlob(vector),
      owner_kind: ownerKind,
      k,
      embedding_profile: profileId,
    });
  }
}

function toBlob(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}
