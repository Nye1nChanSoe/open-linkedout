import type { Context } from "hono";

import serverConfig from "@/config/server.config.js";

/** Paging resolved from a request's query string. */
export type PagingType = {
  limit: number;
  offset: number;
  page: number;
};

/**
 * Reads paging from the query string, clamped to a sane page size.
 * @param context - Hono request context.
 * @returns Limit, offset and the resolved page number.
 */
export function readPaging(context: Context): PagingType {
  const page = Math.max(1, readNumber(context, "page") ?? 1);
  const limit = Math.min(
    serverConfig.MAX_PAGE_SIZE,
    Math.max(1, readNumber(context, "pageSize") ?? serverConfig.DEFAULT_PAGE_SIZE),
  );

  return { limit, offset: (page - 1) * limit, page };
}

/**
 * Reads one numeric query parameter.
 * @param context - Hono request context.
 * @param name - Query parameter name.
 * @returns Parsed number, or undefined when absent or not numeric.
 */
export function readNumber(
  context: Context,
  name: string,
): number | undefined {
  const value = context.req.query(name);

  if (value === undefined || value.trim() === "") return undefined;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Reads one non-empty string query parameter.
 * @param context - Hono request context.
 * @param name - Query parameter name.
 * @returns Trimmed value, or undefined when absent or blank.
 */
export function readText(context: Context, name: string): string | undefined {
  const value = context.req.query(name)?.trim();

  return value ? value : undefined;
}

/**
 * Reads a route parameter that must be a database identifier.
 * @param context - Hono request context.
 * @param name - Route parameter name.
 * @returns Parsed identifier, or undefined when it is not one.
 */
export function readIdParam(
  context: Context,
  name: string,
): number | undefined {
  const parsed = Number(context.req.param(name));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
