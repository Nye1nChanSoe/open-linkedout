import { resolveProjectPath } from "@/utils/utils.js";

const config = {
  /**
   * Absolute path to the extractor installed by `npm run setup:extractor`.
   * Resolved rather than looked up on PATH, which differs between a shell,
   * an IDE terminal, and a spawned child process.
   */
  BINARY_PATH: resolveProjectPath(".venv/bin/restruct"),

  /**
   * ONNX weights downloaded by `npm run setup:models`. Passed explicitly so
   * an install and an extraction cannot resolve to different directories.
   */
  MODELS_DIR_PATH: resolveProjectPath("models"),
  MODELS_DIR_ENV_NAME: "RESTRUCT_MODELS_DIRECTORY",

  /**
   * Where written resume.json artifacts are kept, named by content hash.
   */
  EXTRACTIONS_DIR_PATH: resolveProjectPath("data/extractions"),

  /**
   * Pinned in package.json and verified at scheduler startup.
   * A mismatch changes extracted text, and everything derived from it.
   */
  PINNED_VERSION: "0.2.3",

  /**
   * Shape of resume.json this application knows how to read.
   */
  EXPECTED_SCHEMA_VERSION: "1.0",

  /**
   * A hung child would hold its task in `running` until the next restart.
   */
  TIMEOUT_MS: 180_000,

  /**
   * Exit codes, grouped by decade: 1x input, 2x environment,
   * 3x extraction, 4x output.
   */
  EXIT_CODES: {
    INPUT_NOT_FOUND: 10,
    UNSUPPORTED_FORMAT: 11,
    INVALID_DOCUMENT: 12,
    MODEL_ASSETS_MISSING: 20,
    TESSERACT_MISSING: 21,
    OCR_FAILED: 22,
    MODEL_DOWNLOAD_FAILED: 23,
    EXTRACTION_FAILED: 30,
    OUTPUT_WRITE_FAILED: 40,
  },
};

export default config;
