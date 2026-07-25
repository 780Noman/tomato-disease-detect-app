/**
 * Migration runner keyed on SQLite's `user_version`.
 *
 * Each migration is applied exactly once, in order, inside a transaction.
 * Adding a schema change means appending a migration — never editing an
 * existing one, since shipped devices have already run it.
 */

export interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS scans (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         created_at INTEGER NOT NULL,
         image_path TEXT NOT NULL,
         top_class TEXT NOT NULL,
         category TEXT NOT NULL,
         confidence REAL NOT NULL,
         low_confidence INTEGER NOT NULL,
         scores_json TEXT NOT NULL,
         provider TEXT NOT NULL,
         model_version TEXT,
         class_order_verified INTEGER NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans (created_at DESC)`,
    ],
  },
];

export const SCHEMA_VERSION: number = MIGRATIONS.reduce(
  (max, migration) => Math.max(max, migration.version),
  0,
);

/** Migrations that still need to run, given the database's current version. */
export function pendingMigrations(currentVersion: number): readonly Migration[] {
  return MIGRATIONS.filter((m) => m.version > currentVersion)
    .slice()
    .sort((a, b) => a.version - b.version);
}
