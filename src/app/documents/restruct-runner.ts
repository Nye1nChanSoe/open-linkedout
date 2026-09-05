import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { ExtractionError } from "@/app/errors/extraction-error.js";
import config from "@/config/restruct.config.js";
import type { ResumeExtractorContract } from "@/contracts/resume-extractor.contract.js";
import type {
  RestructExtractionResultType,
  RestructResumeDocumentType,
} from "@/types/resume-extraction.type.js";

const execFileAsync = promisify(execFile);

/**
 * Runs the local Restruct CLI as a child process.
 *
 * Extraction is deterministic, so a repeated run reproduces its failure.
 * Only a failed write is reported as retryable.
 */
export class RestructRunner implements ResumeExtractorContract {
  async readVersion(): Promise<string> {
    const { stdout } = await this.run(["--version"]);

    return stdout.trim().replace(/^restruct\s+/i, "");
  }

  /**
   * @param filePath - Absolute path to the stored resume file.
   * @param outputPath - Absolute path the resume JSON is written to.
   * @returns Parsed document and the artifact it was read from.
   */
  async extract(
    filePath: string,
    outputPath: string,
  ): Promise<RestructExtractionResultType> {
    await this.run([filePath, "--output", outputPath]);

    return {
      document: await this.readDocument(outputPath),
      artifactPath: outputPath,
    };
  }

  private async run(args: string[]) {
    try {
      return await execFileAsync(config.BINARY_PATH, args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          [config.MODELS_DIR_ENV_NAME]: config.MODELS_DIR_PATH,
        },
        timeout: config.TIMEOUT_MS,
      });
    } catch (error) {
      throw this.toExtractionError(error);
    }
  }

  private async readDocument(
    outputPath: string,
  ): Promise<RestructResumeDocumentType> {
    let content: string;

    try {
      content = await readFile(outputPath, "utf8");
    } catch (error) {
      throw new ExtractionError(
        `The extractor reported success but wrote no result to ${outputPath}.`,
        "EXTRACTION_OUTPUT_ERROR",
        true,
        error,
      );
    }

    let document: unknown;

    try {
      document = JSON.parse(content);
    } catch (error) {
      throw new ExtractionError(
        "The extractor wrote a result that is not valid JSON.",
        "EXTRACTION_FAILED",
        false,
        error,
      );
    }

    if (!this.isResumeDocument(document)) {
      throw new ExtractionError(
        "The extractor wrote a result without a schema version.",
        "EXTRACTION_FAILED",
        false,
      );
    }

    if (document.schema_version !== config.EXPECTED_SCHEMA_VERSION) {
      throw new ExtractionError(
        `Resume schema ${document.schema_version} is not supported. ` +
          `This application reads ${config.EXPECTED_SCHEMA_VERSION}.`,
        "EXTRACTION_FAILED",
        false,
      );
    }

    return document;
  }

  private isResumeDocument(
    value: unknown,
  ): value is RestructResumeDocumentType {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof (value as RestructResumeDocumentType).schema_version === "string"
    );
  }

  /**
   * Maps a child-process failure onto a classified application error.
   * @param error - Rejection raised by the spawned extractor.
   */
  private toExtractionError(error: unknown): ExtractionError {
    const failure = error as {
      // ENOENT when the binary is absent, otherwise the process exit code.
      code?: number | string;
      killed?: boolean;
      stderr?: string;
      message?: string;
    };
    const detail = failure.stderr?.trim() || failure.message || "The resume extractor failed.";

    if (failure.code === "ENOENT") {
      return new ExtractionError(
        `The resume extractor is not installed at ${config.BINARY_PATH}. ` +
          "Run `npm run setup:extractor`.",
        "EXTRACTOR_UNAVAILABLE",
        false,
        error,
      );
    }

    if (failure.killed) {
      return new ExtractionError(
        `The resume extractor did not finish within ${config.TIMEOUT_MS} ms.`,
        "EXTRACTION_FAILED",
        false,
        error,
      );
    }

    return new ExtractionError(
      detail,
      this.classifyExitCode(failure.code),
      failure.code === config.EXIT_CODES.OUTPUT_WRITE_FAILED,
      error,
    );
  }

  private classifyExitCode(exitCode: number | string | undefined) {
    switch (exitCode) {
      case config.EXIT_CODES.INPUT_NOT_FOUND:
      case config.EXIT_CODES.UNSUPPORTED_FORMAT:
      case config.EXIT_CODES.INVALID_DOCUMENT:
        return "INVALID_RESUME_INPUT" as const;

      case config.EXIT_CODES.MODEL_ASSETS_MISSING:
      case config.EXIT_CODES.MODEL_DOWNLOAD_FAILED:
        return "EXTRACTOR_UNAVAILABLE" as const;

      case config.EXIT_CODES.TESSERACT_MISSING:
        return "EXTRACTOR_OCR_UNAVAILABLE" as const;

      case config.EXIT_CODES.OCR_FAILED:
      case config.EXIT_CODES.EXTRACTION_FAILED:
        return "EXTRACTION_FAILED" as const;

      case config.EXIT_CODES.OUTPUT_WRITE_FAILED:
        return "EXTRACTION_OUTPUT_ERROR" as const;

      default:
        return "UNKNOWN_ERROR" as const;
    }
  }
}
