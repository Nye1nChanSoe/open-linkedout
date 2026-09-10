import { readFileSync, writeFileSync } from "node:fs";

import { AutoTokenizer } from "@huggingface/transformers";
import * as ort from "onnxruntime-node";
import pc from "picocolors";

/**
 * Regenerates the embedding reference fixture.
 *
 * The fixture exists because a wrong embedder throws no error: wrong pooling,
 * a missing prefix or a different dtype still yields 384 normalized floats
 * with plausible neighbours.
 *
 * Run this ONLY on a deliberate profile change. Regenerating it to make a
 * failing check pass defeats the entire point.
 */
const FIXTURE_PATH = "src/app/embeddings/fixtures/embedding-reference.json";

const MODEL_DIRECTORIES = [
  "./models/bge-small-en-v1.5",
  "./models/all-MiniLM-L6-v2",
];

// text app embeds
const SENTENCES = [
  "Build and operate backend services in production",
  "Experience with Go and microservices",
  "Award-winning pastry chef specialising in French desserts",
  "5+ years of experience with PostgreSQL and Redis",
  "We offer medical insurance and flexible working hours",
];

// rounding that survives runtime drift
const DECIMALS = 5;

type ProfileType = {
  model: string;
  pooling: "cls" | "mean";
  normalized: true;
  maxSeqLength: number;
  dtype: "fp32";
  prefix: null;
};

/**
 * Reads the profile out of the files the model ships with.
 *
 * Pooling is a property of the model, not a constant to remember: BGE is CLS
 * at 512 tokens, MiniLM is mean at 256. Hardcoding either silently
 * mis-encodes the other.
 * @param directory - Model directory.
 * @returns Profile describing how this model must be run.
 */
function readProfile(directory: string): ProfileType {
  const pooling = JSON.parse(
    readFileSync(`${directory}/1_Pooling/config.json`, "utf8"),
  ) as { pooling_mode_cls_token: boolean };
  const sequence = JSON.parse(
    readFileSync(`${directory}/sentence_bert_config.json`, "utf8"),
  ) as { max_seq_length: number };

  return {
    model: directory.split("/").pop()!,
    pooling: pooling.pooling_mode_cls_token ? "cls" : "mean",
    normalized: true,
    maxSeqLength: sequence.max_seq_length,
    dtype: "fp32",
    prefix: null,
  };
}

/**
 * Embeds the reference sentences with one model.
 * @param directory - Model directory.
 * @param profile - Profile read from that directory.
 * @returns One normalized vector per sentence.
 */
async function embed(
  directory: string,
  profile: ProfileType,
): Promise<number[][]> {
  const tokenizer = await AutoTokenizer.from_pretrained(directory, {
    local_files_only: true,
  });
  const session = await ort.InferenceSession.create(`${directory}/model.onnx`);

  const encoded = await tokenizer(SENTENCES, {
    padding: true,
    truncation: true,
    max_length: profile.maxSeqLength,
  });

  const feeds: Record<string, ort.Tensor> = {
    input_ids: toOrtTensor(encoded.input_ids),
    attention_mask: toOrtTensor(encoded.attention_mask),
  };

  // BERT-family exports usually declare token_type_ids; all-zeros means
  // "single sentence", which is what every chunk here is.
  if (session.inputNames.includes("token_type_ids")) {
    feeds.token_type_ids = encoded.token_type_ids
      ? toOrtTensor(encoded.token_type_ids)
      : new ort.Tensor(
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

  const vectors: number[][] = [];

  for (let row = 0; row < batchSize; row++) {
    const pooled =
      profile.pooling === "cls"
        ? // CLS is the first token's final hidden state.
          Array.from(
            { length: dimensions },
            (_, d) => data[row * tokenCount * dimensions + d],
          )
        : meanPool(data, mask, row, tokenCount, dimensions);

    const length = Math.hypot(...pooled);

    vectors.push(pooled.map((value) => value / length));
  }

  return vectors;
}

/**
 * Converts a transformers.js tensor into an onnxruntime one.
 *
 * The two libraries ship separate, structurally incompatible `Tensor` types,
 * so the buffer and shape are handed over explicitly rather than assuming
 * they line up.
 * @param tensor - Tokenizer output.
 * @returns Equivalent onnxruntime tensor.
 */
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

/**
 * Averages every non-padding token.
 * @param data - Flat hidden-state buffer.
 * @param mask - Attention mask, 0 for padding.
 * @param row - Index of the sentence in the batch.
 * @param tokenCount - Padded token count.
 * @param dimensions - Hidden size.
 * @returns Mean-pooled vector, not yet normalized.
 */
function meanPool(
  data: Float32Array,
  mask: BigInt64Array,
  row: number,
  tokenCount: number,
  dimensions: number,
): number[] {
  const sums = new Float64Array(dimensions);
  let counted = 0;

  for (let token = 0; token < tokenCount; token++) {
    if (mask[row * tokenCount + token] === 0n) continue;

    counted++;

    for (let d = 0; d < dimensions; d++) {
      sums[d] += data[(row * tokenCount + token) * dimensions + d];
    }
  }

  return Array.from(sums, (sum) => sum / counted);
}

const profiles = [];

for (const directory of MODEL_DIRECTORIES) {
  const profile = readProfile(directory);
  const vectors = await embed(directory, profile);

  profiles.push({
    ...profile,
    vectors: vectors.map((vector) =>
      vector.map((value) => Number(value.toFixed(DECIMALS))),
    ),
  });

  console.info(
    pc.green("Embedded"),
    pc.dim(":"),
    pc.cyan(profile.model),
    pc.dim("|"),
    pc.cyan(`${profile.pooling} pooling`),
    pc.dim("|"),
    pc.cyan(`${profile.maxSeqLength} tokens`),
    pc.dim("|"),
    pc.cyan(`${vectors.length}x${vectors[0].length}`),
  );
}

writeFileSync(
  FIXTURE_PATH,
  `${JSON.stringify(
    {
      note:
        "Generated by src/commands/embedding.fixture.ts. Regenerate ONLY on a " +
        "deliberate profile change — doing it to silence a failing check " +
        "defeats the purpose.",
      sentences: SENTENCES,
      profiles,
    },
    null,
    2,
  )}\n`,
);

console.info(pc.blueBright("Wrote"), pc.dim(":"), pc.cyan(FIXTURE_PATH));
