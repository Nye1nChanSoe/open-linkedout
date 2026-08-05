import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import pc from "picocolors";

import { ResumeInferenceService } from "@/app/services/resume-inference.service.js";
import llmConfig from "@/config/llm.config.js";
import ollamaConfig from "@/config/ollama.config.js";
import { OllamaClient } from "@/llm/ollama-client.js";
import { createDatabaseConnection } from "@database/connection.js";
import { ResumeInferenceRepository } from "@database/repositories/resume-inference.repository.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { resolveProjectPath } from "@/utils/utils.js";

const resumeId = Number(process.argv[2]);

if (!Number.isInteger(resumeId) || resumeId <= 0) {
  console.log(pc.yellow("Usage: npm run resume:infer -- <resume-id>"));
  process.exit(1);
}

const database = createDatabaseConnection();
const ollamaClient = new OllamaClient();

try {
  const resumeInferenceService = new ResumeInferenceService(
    new ResumeRepository(database),
    new ResumeInferenceRepository(database),
    ollamaClient,
  );
  const result = await resumeInferenceService.execute(resumeId);

  // for simple benchmarking against prompts | models | context-window
  const debugDirectoryPath = resolveProjectPath("data/llm-debugs");
  const debugFilePath = join(
    debugDirectoryPath,
    `${new Date().toISOString().replaceAll(":", "-")}--${result.resumeInference.model_name}.json`,
  );
  const debugResult = {
    ...result.resumeInference,
    inference_json: JSON.parse(result.resumeInference.inference_json),
    inference_config_json: JSON.parse(
      result.resumeInference.inference_config_json,
    ),
  };

  await mkdir(debugDirectoryPath, { recursive: true });
  await writeFile(
    debugFilePath,
    `${JSON.stringify(debugResult, null, 2)}\n`,
  );

  console.info(
    pc.green(result.wasInserted ? "Inferred resume" : "Updated inference"),
    pc.dim(":"),
    pc.blue(`Resume ID ${result.resumeInference.resume_id}`),
    pc.dim("|"),
    pc.cyan(result.resumeInference.model_name),
  );
  console.info(pc.dim(`Saved debug result: ${debugFilePath}`));
  console.info(
    pc.dim("Ollama:"),
    pc.dim("prompt tokens"),
    pc.cyan(String(result.promptEvalCount ?? "unknown")),
    pc.dim("| output tokens"),
    pc.cyan(String(result.evalCount ?? "unknown")),
    pc.dim("| done reason"),
    pc.cyan(result.doneReason ?? "unknown"),
  );
  console.info(pc.cyan("Inference:"));
  console.info(
    pc.dim(
      JSON.stringify(
        JSON.parse(result.resumeInference.inference_json),
        null,
        2,
      ),
    ),
  );
} finally {
  try {
    // extra cleanup for memory :-)
    const response = await fetch(
      new URL(ollamaConfig.ENDPOINTS.GENERATE, ollamaConfig.BASE_URL),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: llmConfig.MODELS.RESUME_INFERENCE,
          keep_alive: 0,
        }),
      },
    );

    if (!response.ok) {
      console.warn(
        pc.yellow(`Could not unload Ollama model (HTTP ${response.status}).`),
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(pc.yellow(`Could not unload Ollama model: ${errorMessage}`));
  }

  database.close();
}
