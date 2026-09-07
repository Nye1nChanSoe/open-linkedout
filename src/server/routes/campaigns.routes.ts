import { Hono } from "hono";

import type { CreateCampaignInputType } from "@/types/campaign.type.js";
import { readIdParam } from "@/server/request.js";
import type { ServerDependenciesType } from "@/server/dependencies.js";

/**
 * Campaign routes: create a scraping intent, watch it, and cancel it.
 * @param dependencies - Services the routes read and write through.
 * @returns Router mounted under /api/campaigns.
 */
export function createCampaignRoutes(dependencies: ServerDependenciesType) {
  const routes = new Hono();

  routes.get("/", (context) =>
    context.json({ campaigns: dependencies.campaignService.listCampaigns() }),
  );

  routes.post("/", async (context) => {
    const body = await context.req.json<Partial<CreateCampaignInputType>>();
    const keywords = normalizeList(body.keywords);
    const locations = normalizeList(body.locations);

    if (!keywords.length || !locations.length) {
      return context.json(
        { error: "A campaign needs at least one keyword and one location." },
        400,
      );
    }

    const campaign = dependencies.campaignService.createCampaign({
      name: body.name?.trim() || `${keywords[0]} — ${locations[0]}`,
      keywords,
      locations,
      maxPagesPerCombination: Math.max(1, body.maxPagesPerCombination ?? 1),
    });

    return context.json({ campaign }, 201);
  });

  routes.get("/:id", (context) => {
    const campaignId = readIdParam(context, "id");

    if (campaignId === undefined) {
      return context.json({ error: "Invalid campaign id." }, 400);
    }

    const campaign = dependencies.campaignService.findCampaign(campaignId);

    return campaign
      ? context.json({ campaign })
      : context.json({ error: `Campaign ${campaignId} not found.` }, 404);
  });

  routes.get("/:id/tasks", (context) => {
    const campaignId = readIdParam(context, "id");

    if (campaignId === undefined) {
      return context.json({ error: "Invalid campaign id." }, 400);
    }

    return context.json({
      tasks: dependencies.schedulerTaskRepository.listByStatus({
        limit: 200,
        offset: 0,
        campaignId,
      }),
    });
  });

  routes.post("/:id/cancel", (context) => {
    const campaignId = readIdParam(context, "id");

    if (campaignId === undefined) {
      return context.json({ error: "Invalid campaign id." }, 400);
    }

    if (!dependencies.campaignService.findCampaign(campaignId)) {
      return context.json({ error: `Campaign ${campaignId} not found.` }, 404);
    }

    return context.json({
      campaign: dependencies.campaignService.cancelCampaign(campaignId),
    });
  });

  return routes;
}

/**
 * Cleans a submitted keyword or location list.
 * @param values - Raw list from the request body.
 * @returns Trimmed, de-duplicated, non-empty values.
 */
function normalizeList(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}
