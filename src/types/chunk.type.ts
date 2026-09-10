/**
 * Which document a chunk came from: jobs | resumes
 */
export type ChunkOwnerKindType = "job" | "resume";

export type ChunkKindType = "bullet" | "paragraph" | "skill";

export type DBChunkRowType = {
  id: number;
  owner_kind: ChunkOwnerKindType;
  owner_id: number;
  section: string;
  kind: ChunkKindType;
  text: string;
  text_hash: string;
  source_path: string;
  chunker_version: string;
  created_at: string;
};

/** One chunk as the chunker produces it, before it has an id. */
export type ChunkInputType = {
  section: string;
  kind: ChunkKindType;
  text: string;
  sourcePath: string;
};

/** Identifies one document's chunk set. */
export type ChunkOwnerType = {
  ownerKind: ChunkOwnerKindType;
  ownerId: number;
};

export type InsertChunkParamsType = Omit<DBChunkRowType, "id">;

export type FindChunksByOwnerParamsType = {
  owner_kind: ChunkOwnerKindType;
  owner_id: number;
};

export type DeleteChunksByOwnerParamsType = FindChunksByOwnerParamsType;

/**
 * Result of replacing a document's chunk set.
 */
export type ReplaceChunksResultType = {
  chunks: DBChunkRowType[];
  deletedCount: number;
};
