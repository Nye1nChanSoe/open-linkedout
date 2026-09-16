import { Hono } from "hono";

import { readIdParam, readNumber, readPaging, readText } from "@/server/request.js";
import type { ServerDependenciesType } from "@/server/dependencies.js";
import type {
  JobListFiltersType,
  JobListSortFieldType,
} from "@/types/job-repository.type.js";
import type { JobApplicationStatusType } from "@/types/job-detail.type.js";
import type { Context } from "hono";

const SORT_FIELDS: JobListSortFieldType[] = [
  "last_seen_at",
  "first_seen_at",
  "title",
  "company",
];

const APPLICATION_STATUSES: JobApplicationStatusType[] = [
  "unknown",
  "open",
  "closed",
  "unavailable",
];

/**
 * Job routes: the ranked list the UI browses and one job in full.
 * @param dependencies - Repositories the routes read through.
 * @returns Router mounted under /api/jobs.
 */
export function createJobRoutes(dependencies: ServerDependenciesType) {
  const routes = new Hono();

  routes.get("/", (context) => {
    const paging = readPaging(context);
    const filters = readJobFilters(context);

    return context.json({
      jobs: dependencies.jobRepository.list({
        ...paging,
        filters,
        sortField: readSortField(context),
        sortDirection: context.req.query("sortDirection") === "asc" ? "asc" : "desc",
      }),
      total: dependencies.jobRepository.count(filters),
      page: paging.page,
      pageSize: paging.limit,
    });
  });

  routes.get("/semantic", async (context) => {
    const query = readText(context, "q");
    const k = Math.min(50, Math.max(1, readNumber(context, "k") ?? 20));
    const { embeddingClient, chunkEmbeddingRepository, jobRepository } =
      dependencies;

    if (!query) {
      return context.json({ error: "Query parameter q is required." }, 400);
    }

    if (!embeddingClient) {
      return context.json(
        {
          error:
            "Embedding model is not installed. Run npm run setup:embedding-model.",
        },
        503,
      );
    }

    const hits = chunkEmbeddingRepository.search(
      await embeddingClient.embedQuery(query),
      embeddingClient.profileId,
      "job",
      k,
    );

    return context.json({
      query,
      embeddingProfile: embeddingClient.profileId,
      hits: hits.map((hit) => {
        const job = jobRepository.findById(hit.owner_id);

        return {
          jobId: hit.owner_id,
          title: job?.title ?? null,
          company: job?.company ?? null,
          similarity: 1 - hit.distance,
          section: hit.section,
          kind: hit.kind,
          text: hit.text,
          sourcePath: hit.source_path,
        };
      }),
    });
  });

  routes.get("/:id", (context) => {
    const jobId = readIdParam(context, "id");

    if (jobId === undefined) {
      return context.json({ error: "Invalid job id." }, 400);
    }

    const job = dependencies.jobRepository.findById(jobId);

    if (!job) {
      return context.json({ error: `Job ${jobId} not found.` }, 404);
    }

    return context.json({
      job,
      detail: dependencies.jobDetailRepository.findByJobId(jobId) ?? null,
      discoveries: dependencies.jobDiscoveryRepository.findByJobId(jobId),
    });
  });

  return routes;
}

/**
 * Reads the job filters the list view supports.
 * @param context - Hono request context.
 * @returns Filters present in the query string.
 */
function readJobFilters(context: Context): JobListFiltersType {
  const applicationStatus = readText(context, "applicationStatus");
  const hasDetail = context.req.query("hasDetail");

  return {
    company: readText(context, "company"),
    location: readText(context, "location"),
    applicationStatus: APPLICATION_STATUSES.find(
      (status) => status === applicationStatus,
    ),
    discoveryKeyword: readText(context, "keyword"),
    campaignId: readNumber(context, "campaignId"),
    seenFrom: readText(context, "seenFrom"),
    seenTo: readText(context, "seenTo"),
    searchText: readText(context, "q"),
    hasDetail: hasDetail === undefined ? undefined : hasDetail === "true",
  };
}

function readSortField(context: Context): JobListSortFieldType {
  const requested = context.req.query("sortField");

  return SORT_FIELDS.find((field) => field === requested) ?? "last_seen_at";
}
