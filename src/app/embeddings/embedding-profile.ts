import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import config from "@/config/embedding.config.js";
import type { EmbeddingProfileType } from "@/types/embedding.type.js";

/**
 * Builds the profile from the pinned config and the files the model ships
 * with. Pooling and sequence length are read, not hardcoded.
 * @returns Profile of the installed embedding model.
 */
export function readEmbeddingProfile(): EmbeddingProfileType {
  const pooling = readJson<{
    word_embedding_dimension: number;
    pooling_mode_cls_token: boolean;
    pooling_mode_mean_tokens: boolean;
  }>("1_Pooling/config.json");
  const sentenceBert = readJson<{ max_seq_length: number }>(
    "sentence_bert_config.json",
  );

  if (pooling.pooling_mode_cls_token === pooling.pooling_mode_mean_tokens) {
    throw new Error(
      `Unsupported pooling in ${config.MODEL_REPOSITORY}: expected exactly one of CLS or mean.`,
    );
  }

  const model = config.MODEL_FILES.find(
    (file) => file.localName === "model.onnx",
  )!;

  return {
    repository: config.MODEL_REPOSITORY,
    revision: config.MODEL_REVISION,
    modelSha256: model.sha256,
    pooling: pooling.pooling_mode_cls_token ? "cls" : "mean",
    normalized: true,
    maxSeqLength: sentenceBert.max_seq_length,
    dimensions: pooling.word_embedding_dimension,
    dtype: config.DTYPE,
    queryPrefix: config.QUERY_PREFIX,
    passagePrefix: config.PASSAGE_PREFIX,
  };
}

/**
 * The identifier stored beside every vector, e.g. `bge-small-en-v1.5-1a2b3c4d5e6f`.
 * @param profile - Embedding profile.
 * @returns Model name plus a hash over the whole profile.
 */
export function toEmbeddingProfileId(profile: EmbeddingProfileType): string {
  const hash = createHash("sha256")
    // Sorted keys: reordering fields in code must not look like a new profile.
    .update(JSON.stringify(profile, Object.keys(profile).sort()))
    .digest("hex")
    .slice(0, 12);

  return `${profile.repository.split("/").pop()}-${hash}`;
}

function readJson<T>(fileName: string): T {
  return JSON.parse(
    readFileSync(join(config.MODEL_DIR_PATH, fileName), "utf8"),
  ) as T;
}
