import type { EmbeddingProfileType } from "@/types/embedding.type.js";

/**
 * Turns text into normalized vectors. Queries and passages are separate
 * methods because retrieval models prefix them differently.
 */
export interface EmbeddingClientContract {
  /** What produced the vectors; stored beside each one. */
  readonly profile: EmbeddingProfileType;
  readonly profileId: string;

  /**
   * Embeds stored text: job and resume chunks.
   * @param texts - Passages in any number; batching is the client's concern.
   * @returns One vector per passage, in input order.
   */
  embedPassages(texts: string[]): Promise<Float32Array[]>;

  /**
   * Embeds a search query.
   * @param text - Query as the user typed it.
   * @returns One vector.
   */
  embedQuery(text: string): Promise<Float32Array>;
}
