import { resolveProjectPath } from "@/utils/utils.js";

const config = {
  /**
   * Absolute path to the SQLite database file.
   */
  DATABASE_FILE_PATH: resolveProjectPath("./data/linkedout.db"),

  /**
   * Maximum time, in milliseconds, to wait for a locked database.
   */
  DATABASE_BUSY_TIMEOUT_MS: 5_000,

  /**
   * SQLite journal mode.
   *
   * Available modes:
   * DELETE (default) | TRUNCATE | PERSIST | MEMORY | WAL | OFF
   */
  DATABASE_JOURNAL_MODE: "WAL",

  /**
   * SQLite synchronous mode.
   *
   * Available modes:
   * OFF | NORMAL | FULL | EXTRA
   */
  DATABASE_SYNCHRONOUS_MODE: "NORMAL",

  /**
   * Enables SQLite foreign key constraint enforcement.
   */
  DATABASE_FOREIGN_KEYS_ENABLED: true,

  /**
   * Migration files directory path
   */
  MIGRATIONS_DIRECTORY_PATH: resolveProjectPath("./database/migrations"),
} as const;

export default config;
