import { EventEmitter } from "node:events";

import type {
  AppEventListenerType,
  AppEventType,
  PublishedAppEventType,
} from "@/types/app-event.type.js";

const APP_EVENT_CHANNEL = "app-event";

/**
 * In-process publisher for everything the UI watches live.
 *
 * Publishing must never break the work that produced the event, so a
 * listener that throws is isolated rather than propagated.
 */
export class AppEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // One listener per open browser tab, plus the log listener.
    this.emitter.setMaxListeners(0);
  }

  /**
   * Publishes one application event to every current subscriber.
   * @param event - Event to publish.
   */
  publish(event: AppEventType): void {
    const publishedEvent: PublishedAppEventType = {
      ...event,
      emittedAt: new Date().toISOString(),
    };

    this.emitter.emit(APP_EVENT_CHANNEL, publishedEvent);
  }

  /**
   * Subscribes to every published event.
   * @param listener - Receives each published event.
   * @returns Unsubscribe function.
   */
  subscribe(listener: AppEventListenerType): () => void {
    const safeListener: AppEventListenerType = (event) => {
      try {
        listener(event);
      } catch {
        // A disconnected SSE stream must not fail the scheduler.
      }
    };

    this.emitter.on(APP_EVENT_CHANNEL, safeListener);

    return () => this.emitter.off(APP_EVENT_CHANNEL, safeListener);
  }
}
