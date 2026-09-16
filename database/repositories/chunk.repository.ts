import type BetterSqlite3 from "better-sqlite3";

import type {
  ChunkOwnerKindType,
  ChunkOwnerType,
  ChunkRowInputType,
  DBChunkRowType,
  DeleteChunksByOwnerParamsType,
  FindChunksByOwnerParamsType,
  InsertChunkParamsType,
  ReplaceChunksResultType,
} from "@/types/chunk.type.js";
import type { DatabaseConnectionType } from "@/types/database.type.js";

export class ChunkRepository {
  private readonly insertStatement: BetterSqlite3.Statement<
    [InsertChunkParamsType]
  >;

  private readonly deleteByOwnerStatement: BetterSqlite3.Statement<
    [DeleteChunksByOwnerParamsType]
  >;

  private readonly findByOwnerStatement: BetterSqlite3.Statement<
    [FindChunksByOwnerParamsType],
    DBChunkRowType
  >;

  private readonly listJobIdsNeedingChunkingStatement: BetterSqlite3.Statement<
    [{ chunker_version: string }],
    { owner_id: number }
  >;

  private readonly listResumeIdsNeedingChunkingStatement: BetterSqlite3.Statement<
    [{ chunker_version: string }],
    { owner_id: number }
  >;

  private readonly replaceForOwnerTransaction: (
    owner: FindChunksByOwnerParamsType,
    rows: ChunkRowInputType[],
  ) => ReplaceChunksResultType;

  constructor(private readonly database: DatabaseConnectionType) {
    this.insertStatement = database.prepare(
      `
      INSERT INTO chunks (
        owner_kind,
        owner_id,
        section,
        kind,
        text,
        text_hash,
        source_path,
        chunker_version,
        created_at
      )
      VALUES (
        @owner_kind,
        @owner_id,
        @section,
        @kind,
        @text,
        @text_hash,
        @source_path,
        @chunker_version,
        @created_at
      );
    `,
    );

    this.deleteByOwnerStatement = database.prepare(
      `
      DELETE FROM chunks
      WHERE owner_kind = @owner_kind AND owner_id = @owner_id;
    `,
    );

    this.findByOwnerStatement = database.prepare(
      `
      SELECT *
      FROM chunks
      WHERE owner_kind = @owner_kind AND owner_id = @owner_id
      ORDER BY id;
    `,
    );

    // A document's chunks are replaced together, so one row at the current
    // version means the whole set is current.
    this.listJobIdsNeedingChunkingStatement = database.prepare(
      `
      SELECT s.job_id AS owner_id
      FROM job_structures s
      WHERE NOT EXISTS (
        SELECT 1 FROM chunks c
        WHERE c.owner_kind = 'job'
          AND c.owner_id = s.job_id
          AND c.chunker_version = @chunker_version
      )
      ORDER BY s.job_id;
    `,
    );

    this.listResumeIdsNeedingChunkingStatement = database.prepare(
      `
      SELECT e.resume_id AS owner_id
      FROM resume_extractions e
      WHERE NOT EXISTS (
        SELECT 1 FROM chunks c
        WHERE c.owner_kind = 'resume'
          AND c.owner_id = e.resume_id
          AND c.chunker_version = @chunker_version
      )
      ORDER BY e.resume_id;
    `,
    );

    this.replaceForOwnerTransaction = database.transaction(
      (owner: FindChunksByOwnerParamsType, rows: ChunkRowInputType[]) => {
        const { changes } = this.deleteByOwnerStatement.run(owner);

        for (const row of rows) {
          this.insertStatement.run({ ...row, ...owner });
        }

        return {
          chunks: this.findByOwnerStatement.all(owner),
          deletedCount: changes,
        };
      },
    );
  }

  /**
   * Replaces a document's whole chunk set in one transaction.
   * @param owner - Document the chunks belong to.
   * @param rows - New chunks in document order.
   * @returns Stored chunks and how many old ones were removed.
   */
  replaceForOwner(
    owner: ChunkOwnerType,
    rows: ChunkRowInputType[],
  ): ReplaceChunksResultType {
    return this.replaceForOwnerTransaction(toOwnerParams(owner), rows);
  }

  /**
   * Lists documents with no chunks from the given chunker version.
   * @param ownerKind - Jobs (from job_structures) or resumes (from resume_extractions).
   * @param chunkerVersion - Version the sweep considers current.
   * @returns Owner identifiers needing chunking, oldest first.
   */
  listOwnerIdsNeedingChunking(
    ownerKind: ChunkOwnerKindType,
    chunkerVersion: string,
  ): number[] {
    const statement =
      ownerKind === "job"
        ? this.listJobIdsNeedingChunkingStatement
        : this.listResumeIdsNeedingChunkingStatement;

    return statement
      .all({ chunker_version: chunkerVersion })
      .map((row) => row.owner_id);
  }

  /**
   * Lists a document's chunks in document order.
   * @param owner - Document the chunks belong to.
   * @returns Stored chunks, empty if it has none.
   */
  listByOwner(owner: ChunkOwnerType): DBChunkRowType[] {
    return this.findByOwnerStatement.all(toOwnerParams(owner));
  }
}

function toOwnerParams(owner: ChunkOwnerType): FindChunksByOwnerParamsType {
  return { owner_kind: owner.ownerKind, owner_id: owner.ownerId };
}
