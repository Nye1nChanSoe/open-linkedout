import { Hono } from "hono";

import { readIdParam } from "@/server/request.js";
import type { ServerDependenciesType } from "@/server/dependencies.js";

/**
 * Resume routes: what has been imported and what was extracted from it.
 * @param dependencies - Repositories and services the routes use.
 * @returns Router mounted under /api/resumes.
 */
export function createResumeRoutes(dependencies: ServerDependenciesType) {
  const routes = new Hono();

  routes.get("/", (context) =>
    context.json({ resumes: dependencies.resumeRepository.list() }),
  );

  routes.get("/:id", (context) => {
    const resumeId = readIdParam(context, "id");

    if (resumeId === undefined) {
      return context.json({ error: "Invalid resume id." }, 400);
    }

    const resume = dependencies.resumeRepository.findById(resumeId);

    if (!resume) {
      return context.json({ error: `Resume ${resumeId} not found.` }, 404);
    }

    return context.json({
      resume,
      extraction:
        dependencies.resumeExtractionRepository.findByResumeId(resumeId) ??
        null,
    });
  });

  /**
   * Imports a resume already on this machine. The file is read from a local
   * path rather than uploaded: the whole tool runs on one machine.
   */
  routes.post("/", async (context) => {
    const body = await context.req.json<{ sourcePath?: string }>();

    if (!body.sourcePath?.trim()) {
      return context.json({ error: "A local sourcePath is required." }, 400);
    }

    const result = await dependencies.resumeService.execute({
      sourcePath: body.sourcePath.trim(),
    });

    return context.json(result, result.wasImported ? 201 : 200);
  });

  return routes;
}
