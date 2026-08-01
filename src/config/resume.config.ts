import { ResumeSourceFormatType } from "@/types/resume.type.js";
import { resolveProjectPath } from "@/utils/utils.js";

const config = {
  /**
   * Absolute path to the resume file
   */
  RESUME_DIR_PATH: resolveProjectPath("data/resumes"),

  /**
   * Supported Formats:
   */
  SUPPORTED_RESUME_FORMATS: {
    ".pdf": { format: "pdf" },
    ".docx": { format: "docx" },
    ".txt": { format: "txt" },
  } as Record<string, { format: ResumeSourceFormatType }>,

  /**
   * Hash method for content
   * Hash digest for content
   */
  HASH_FUNCTION: "sha256",
  HASH_DIGEST: "hex" as BufferEncoding,
};

export default config;
