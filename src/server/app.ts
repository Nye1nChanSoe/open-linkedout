import { existsSync } from "node:fs";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import pc from "picocolors";

import { ApplicationError } from "@/app/errors/application-error.js";
import serverConfig from "@/config/server.config.js";
import type { ServerDependenciesType } from "@/server/dependencies.js";
import { streamAppEvents } from "@/server/events.js";
import { createCampaignRoutes } from "@/server/routes/campaigns.routes.js";
import { createJobRoutes } from "@/server/routes/jobs.routes.js";
import { createResumeRoutes } from "@/server/routes/resumes.routes.js";
import { createTaskRoutes } from "@/server/routes/tasks.routes.js";

/**
 * Builds the local HTTP application: JSON API, event stream, and the built
 * React app once one exists.
 * @param dependencies - Services and repositories the routes use.
 * @returns Configured Hono application.
 */
export function createApp(dependencies: ServerDependenciesType): Hono {
  const app = new Hono();

  app.get("/api/health", (context) =>
    context.json({ status: "ok", startedAt: new Date().toISOString() }),
  );

  app.route("/api/campaigns", createCampaignRoutes(dependencies));
  app.route("/api/jobs", createJobRoutes(dependencies));
  app.route("/api/tasks", createTaskRoutes(dependencies));
  app.route("/api/resumes", createResumeRoutes(dependencies));

  app.get("/api/events", (context) =>
    streamAppEvents(context, dependencies.appEventBus),
  );

  // The UI is built separately, so the API runs perfectly well without it.
  if (existsSync(serverConfig.WEB_DIST_DIRECTORY_PATH)) {
    app.use("/*", serveStatic({ root: "./web/dist" }));
    app.get("/*", serveStatic({ path: "./web/dist/index.html" }));
  }

  app.onError((error, context) => {
    console.error(pc.red("API error"), pc.dim(":"), error);

    const code = error instanceof ApplicationError ? error.code : undefined;

    return context.json({ error: error.message, code }, 500);
  });

  return app;
}
