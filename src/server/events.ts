import type { Context } from "hono";

import { AppEventBus } from "@/app/events/app-event-bus.js";
import serverConfig from "@/config/server.config.js";
import type { PublishedAppEventType } from "@/types/app-event.type.js";

/**
 * Streams every published application event to one browser connection.
 * @param context - Hono request context for the SSE connection.
 * @param appEventBus - Bus to subscribe the connection to.
 * @returns Streaming SSE response.
 */
export function streamAppEvents(
  context: Context,
  appEventBus: AppEventBus,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) =>
        controller.enqueue(encoder.encode(payload));

      const unsubscribe = appEventBus.subscribe(
        (event: PublishedAppEventType) => {
          send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        },
      );

      const keepAlive = setInterval(
        () => send(": keep-alive\n\n"),
        serverConfig.SSE_KEEPALIVE_INTERVAL_MS,
      );

      // The browser closes the stream on navigation and on reload; both
      // must release the subscription and the timer.
      context.req.raw.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribe();
        controller.close();
      });

      send(": connected\n\n");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
