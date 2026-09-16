import type { ChunkKindType, ChunkOwnerKindType } from "@/types/chunk.type.js";

export type EmbeddingPoolingType = "cls" | "mean";

/**
 * Everything that decides what vector a text becomes. Two vectors are only
 * comparable when every field matches; equal dimensions prove nothing.
 */
export type EmbeddingProfileType = {
  repository: string;
  revision: string;
  modelSha256: string;
  pooling: EmbeddingPoolingType;
  normalized: true;
  maxSeqLength: number;
  dimensions: number;
  dtype: string;
  queryPrefix: string;
  passagePrefix: string;
};

export type ChunkNeedingEmbeddingType = {
  id: number;
  owner_kind: ChunkOwnerKindType;
  text: string;
  text_hash: string;
};

export type ChunkEmbeddingInputType = {
  chunkId: number;
  ownerKind: ChunkOwnerKindType;
  vector: Float32Array;
};

export type ChunkSearchHitType = {
  chunk_id: number;
  owner_id: number;
  section: string;
  kind: ChunkKindType;
  text: string;
  source_path: string;
  /** Cosine distance: 1 - similarity. */
  distance: number;
};
