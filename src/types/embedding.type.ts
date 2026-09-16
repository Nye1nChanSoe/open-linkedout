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
