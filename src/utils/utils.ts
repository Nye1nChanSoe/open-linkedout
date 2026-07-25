import path from "node:path";

/**
 * Resolves a path relative to project root
 * @param segment - path starting from project root
 */
export function resolveProjectPath(segment: string): string {
  return path.resolve(process.cwd(), segment);
}
