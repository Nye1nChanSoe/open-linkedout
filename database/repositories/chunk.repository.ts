import type BetterSqlite3 from "better-sqlite3";

import type {
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
