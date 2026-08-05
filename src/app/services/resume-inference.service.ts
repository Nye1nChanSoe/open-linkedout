import { createHash } from "node:crypto";

import llmConfig from "@/config/llm.config.js";
import resumeConfig from "@/config/resume.config.js";
import type { OllamaClientContract } from "@/contracts/ollama-client.contract.js";
import { parseResumeInference } from "@/llm/parse-resume-inference.js";
import { ResumeInferenceRepository } from "@database/repositories/resume-inference.repository.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { runRepositoryOperationSafely } from "@/utils/utils.js";
import {
  resumeInferencePromptVersion,
  resumeInferenceSystemPrompt,
} from "@/llm/prompts/resume-inference/v1.js";
import {
  resumeInferenceJsonSchema,
  resumeInferenceSchemaVersion,
} from "@/llm/schemas/resume-inference/v1.js";

/**
 * Generates and persists structured inference for one processed resume.
 */
export class ResumeInferenceService {
  constructor(
    private readonly resumeRepository: ResumeRepository,
    private readonly resumeInferenceRepository: ResumeInferenceRepository,
    private readonly ollamaClient: OllamaClientContract,
  ) {}

  async execute(resumeId: number) {
    const resume = runRepositoryOperationSafely(`load resume ${resumeId}`, () =>
      this.resumeRepository.findById(resumeId),
    );

    if (!resume) throw new Error(`Resume ${resumeId} was not found.`);

    if (resume.processing_status !== "completed" || !resume.normalized_text) {
      throw new Error(`Resume ${resumeId} has no completed normalized text.`);
    }

    const normalizedText = resume.normalized_text;

    const response = await this.ollamaClient.chat({
      model: llmConfig.MODELS.RESUME_INFERENCE,
      messages: [
        { role: "system", content: resumeInferenceSystemPrompt },
        { role: "user", content: normalizedText },
      ],
      format: resumeInferenceJsonSchema,
      think: llmConfig.INFERENCE.IS_THINKING,
      options: llmConfig.INFERENCE.OPTIONS,
    });
    const inference = parseResumeInference(response.content);

    const persistenceResult = runRepositoryOperationSafely(
      `save inference for resume ${resume.id}`,
      () =>
        this.resumeInferenceRepository.upsertInference({
          resumeId: resume.id,
          inference,
          sourceTextHash: createHash(resumeConfig.HASH_FUNCTION)
            .update(normalizedText)
            .digest(resumeConfig.HASH_DIGEST),
          modelName: response.model,
          promptVersion: resumeInferencePromptVersion,
          schemaVersion: resumeInferenceSchemaVersion,
          inferenceConfig: {
            ...llmConfig.INFERENCE.OPTIONS,
            think: llmConfig.INFERENCE.IS_THINKING,
          },
        }),
    );

    return {
      ...persistenceResult,
      promptEvalCount: response.promptEvalCount,
      evalCount: response.evalCount,
      doneReason: response.doneReason,
    };
  }
}
