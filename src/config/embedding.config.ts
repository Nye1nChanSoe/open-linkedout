import { resolveProjectPath } from "@/utils/utils.js";

const config = {
  MODEL_DIR_PATH: resolveProjectPath("models/bge-small-en-v1.5"),

  /**
   * Pinned by commit and SHA-256, the same way restruct pins its models.
   * The commit says which files
   * The digest says the bytes arrived intact.
   */
  MODEL_REPOSITORY: "BAAI/bge-small-en-v1.5",
  MODEL_REVISION: "5c38ec7c405ec4b44b94cc5a9bb96e735b38267a",

  /**
   * BGE is trained with an instruction on the query side only.
   * Passages (job | resume chunks) are embedded as written.
   */
  QUERY_PREFIX: "Represent this sentence for searching relevant passages: ",
  PASSAGE_PREFIX: "",

  DTYPE: "fp32",

  /**
   * A batch pads to its longest text, so larger batches waste work on padding.
   * Measured in the spike: batch 8 was 2.4x cheaper per chunk than 32.
   */
  BATCH_SIZE: 8,

  /** Chunks read per round of an embed task; each round commits its vectors. */
  CHUNKS_PER_ROUND: 256,

  /** Only the files the embedder opens. */
  MODEL_FILES: [
    {
      remotePath: "onnx/model.onnx",
      localName: "model.onnx",
      size: 133_093_490,
      sha256:
        "828e1496d7fabb79cfa4dcd84fa38625c0d3d21da474a00f08db0f559940cf35",
    },
    {
      remotePath: "tokenizer.json",
      localName: "tokenizer.json",
      size: 711_396,
      sha256:
        "d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66",
    },
    {
      remotePath: "tokenizer_config.json",
      localName: "tokenizer_config.json",
      size: 366,
      sha256:
        "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3",
    },
    {
      remotePath: "special_tokens_map.json",
      localName: "special_tokens_map.json",
      size: 125,
      sha256:
        "b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3",
    },
    {
      remotePath: "vocab.txt",
      localName: "vocab.txt",
      size: 231_508,
      sha256:
        "07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3",
    },
    {
      remotePath: "config.json",
      localName: "config.json",
      size: 743,
      sha256:
        "094f8e891b932f2000c92cfc663bac4c62069f5d8af5b5278c4306aef3084750",
    },
    {
      remotePath: "sentence_bert_config.json",
      localName: "sentence_bert_config.json",
      size: 52,
      sha256:
        "84e39fda68ccbff05bfa723ae9c0e70e23e2ec373b76e0f8c6e71af72a693cbf",
    },
    {
      remotePath: "1_Pooling/config.json",
      localName: "1_Pooling/config.json",
      size: 190,
      sha256:
        "d1caf60c96f5fba2157c0c26b76d80818fad6cf0b8eb5e73ec372ff9818eba5c",
    },
  ],
} as const;

export default config;
