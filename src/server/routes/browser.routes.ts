import { Hono } from "hono";

import type { ServerDependenciesType } from "@/server/dependencies.js";

/**
 * Browser routes: lift the pause that a closed browser puts scraping into.
 * @param dependencies - Services the routes read and write through.
 * @returns Router mounted under /api/browser.
 */
export function createBrowserRoutes(dependencies: ServerDependenciesType) {
  const routes = new Hono();

  routes.get("/", (context) =>
    context.json({
      isPaused: dependencies.browserSession.isPaused(),
      isOpen: dependencies.browserSession.isOpen(),
    }),
  );

  routes.post("/resume", (context) => {
    dependencies.browserSession.resume();

    return context.json({ isPaused: false });
  });

  return routes;
}
