import { join } from "node:path";

import {
  AutoTokenizer,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";
import * as ort from "onnxruntime-node";

import {
  readEmbeddingProfile,
  toEmbeddingProfileId,
} from "@/app/embeddings/embedding-profile.js";
import config from "@/config/embedding.config.js";
import type { EmbeddingClientContract } from "@/contracts/embedding-client.contract.js";
import type { EmbeddingProfileType } from "@/types/embedding.type.js";

type LoadedModelType = {
  tokenizer: PreTrainedTokenizer;
  session: ort.InferenceSession;
};

/**
 * In-process ONNX embedder. The model loads on first use, 
 * and one batch runs at a time.
 */
export class OnnxEmbedder implements EmbeddingClientContract {
  readonly profileId: string;

  private loading?: Promise<LoadedModelType>;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(readonly profile: EmbeddingProfileType = readEmbeddingProfile()) {
    this.profileId = toEmbeddingProfileId(profile);
  }

  async embedPassages(texts: string[]): Promise<Float32Array[]> {
    const vectors: Float32Array[] = [];

    for (let start = 0; start < texts.length; start += config.BATCH_SIZE) {
      const batch = texts
        .slice(start, start + config.BATCH_SIZE)
        .map((text) => this.profile.passagePrefix + text);

      vectors.push(...(await this.enqueue(() => this.embedBatch(batch))));
    }

    return vectors;
  }

  async embedQuery(text: string): Promise<Float32Array> {
    const [vector] = await this.enqueue(() =>
      this.embedBatch([this.profile.queryPrefix + text]),
    );

    return vector;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);

    this.queue = result.catch(() => undefined);

    return result;
  }

  private load(): Promise<LoadedModelType> {
    this.loading ??= Promise.all([
      AutoTokenizer.from_pretrained(config.MODEL_DIR_PATH, {
        local_files_only: true,
      }),
      ort.InferenceSession.create(join(config.MODEL_DIR_PATH, "model.onnx")),
    ]).then(([tokenizer, session]) => ({ tokenizer, session }));

    return this.loading;
  }

  private async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const { tokenizer, session } = await this.load();

    const encoded = await tokenizer(texts, {
      padding: true,
      truncation: true,
      max_length: this.profile.maxSeqLength,
    });

    const feeds: Record<string, ort.Tensor> = {
      input_ids: toOrtTensor(encoded.input_ids),
      attention_mask: toOrtTensor(encoded.attention_mask),
    };

    // All zeros: every text is a single sentence, never a pair.
    if (session.inputNames.includes("token_type_ids")) {
      feeds.token_type_ids = new ort.Tensor(
        "int64",
        new BigInt64Array((encoded.input_ids.data as BigInt64Array).length),
        encoded.input_ids.dims as number[],
      );
    }

    const output = await session.run(feeds);
    const hidden = output[session.outputNames[0]];
    const [batchSize, tokenCount, dimensions] = hidden.dims as number[];
    const data = hidden.data as Float32Array;
    const mask = encoded.attention_mask.data as BigInt64Array;

    return Array.from({ length: batchSize }, (_, row) => {
      const offset = row * tokenCount * dimensions;
      const pooled =
        this.profile.pooling === "cls"
          ? data.slice(offset, offset + dimensions)
          : meanPool(data, mask, row, tokenCount, dimensions);

      return normalize(pooled);
    });
  }
}

/** transformers.js and onnxruntime ship separate Tensor types. */
function toOrtTensor(tensor: {
  data: unknown;
  dims: readonly number[];
}): ort.Tensor {
  return new ort.Tensor(
    "int64",
    tensor.data as BigInt64Array,
    tensor.dims as number[],
  );
}

function meanPool(
  data: Float32Array,
  mask: BigInt64Array,
  row: number,
  tokenCount: number,
  dimensions: number,
): Float32Array {
  const pooled = new Float32Array(dimensions);
  let counted = 0;

  for (let token = 0; token < tokenCount; token++) {
    if (mask[row * tokenCount + token] === 0n) continue;

    counted++;

    const offset = (row * tokenCount + token) * dimensions;

    for (let d = 0; d < dimensions; d++) pooled[d] += data[offset + d];
  }

  return pooled.map((sum) => sum / counted);
}

function normalize(vector: Float32Array): Float32Array {
  const length = Math.hypot(...vector);

  return vector.map((value) => value / length);
}
