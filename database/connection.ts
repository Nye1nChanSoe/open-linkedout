import Database from "better-sqlite3";
import config from "@/config/database.config.js";
import type { DatabaseConnectionType } from "@/types/database.type.js";

/**
 * Opens and configures the SQLite database connection.
 */
export function createDatabaseConnection(): DatabaseConnectionType {
  const database = new Database(config.DATABASE_FILE_PATH);

  database.pragma(`busy_timeout = ${config.DATABASE_BUSY_TIMEOUT_MS}`);
  database.pragma(`journal_mode = ${config.DATABASE_JOURNAL_MODE}`);
  database.pragma(`synchronous = ${config.DATABASE_SYNCHRONOUS_MODE}`);
  database.pragma(
    `foreign_keys = ${config.DATABASE_FOREIGN_KEYS_ENABLED ? "ON" : "OFF"}`,
  );

  return database;
}
