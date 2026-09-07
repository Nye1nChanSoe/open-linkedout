import { resolveProjectPath } from "@/utils/utils.js";

const config = {
  /** Local-only tool: the API is never exposed beyond this machine. */
  HOST: "127.0.0.1",

  PORT: 3000,

  /** Built React application served by the API process. */
  WEB_DIST_DIRECTORY_PATH: resolveProjectPath("./web/dist"),

  /** Page size used when a request does not ask for one. */
  DEFAULT_PAGE_SIZE: 50,

  MAX_PAGE_SIZE: 200,

  /**
   * Comment lines sent to idle SSE connections. Without them a proxy or a
   * sleeping browser tab can drop a stream that is simply quiet.
   */
  SSE_KEEPALIVE_INTERVAL_MS: 25_000,

  /** How long a worker waits before looking for queued tasks again. */
  WORKER_IDLE_POLL_INTERVAL_MS: 1_000,
} as const;

export default config;
