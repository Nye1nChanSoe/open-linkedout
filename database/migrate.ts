import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

import config from "@/config/database.config.js";
import type { DatabaseConnectionType } from "@/types/database.type.js";
import { createDatabaseConnection } from "./connection.js";

/**
 * Runs all unapplied database migrations.
 */
export function runMigrations(): void {
  const database = createDatabaseConnection();

  try {
    createSchemaMigrationsTable(database);

    const appliedMigrations = getAppliedMigrations(database);
    const migrationFiles = getMigrationFiles();

    for (const migrationFile of migrationFiles) {
      if (appliedMigrations.has(migrationFile)) {
        console.log(pc.yellow(`Already migrated: ${migrationFile}`));
        continue;
      }

      applyMigration(database, migrationFile);
      console.log(pc.green(`Applied migration: ${migrationFile}`));
    }
  } finally {
    database.close();
  }
}

function createSchemaMigrationsTable(database: DatabaseConnectionType): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function getAppliedMigrations(database: DatabaseConnectionType): Set<string> {
  const rows = database
    .prepare<[], { filename: string }>(
      `
      SELECT filename
      FROM schema_migrations;
    `,
    )
    .all();

  return new Set(rows.map((row) => row.filename));
}

function getMigrationFiles(): string[] {
  return fs
    .readdirSync(config.MIGRATIONS_DIRECTORY_PATH)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
}

function applyMigration(
  database: DatabaseConnectionType,
  filename: string,
): void {
  const migrationPath = path.join(config.MIGRATIONS_DIRECTORY_PATH, filename);

  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  const transaction = database.transaction(() => {
    database.exec(migrationSql);

    database
      .prepare(
        `
        INSERT INTO schema_migrations (
          filename,
          applied_at
        )
        VALUES (?, ?);
      `,
      )
      .run(filename, new Date().toISOString());
  });

  transaction();
}

runMigrations();
