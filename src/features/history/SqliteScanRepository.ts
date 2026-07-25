import type { SQLiteDatabase } from 'expo-sqlite';

import type { ScanRepository } from './ScanRepository';
import type { NewScan, SavedScan } from './types';
import { MIGRATIONS, pendingMigrations, SCHEMA_VERSION } from '@/db/migrations';
import { isClassCode, type Category, type ClassCode } from '@/config/classes';
import type { ClassScore, InferenceProviderName } from '@/inference/types';

export const DATABASE_NAME = 'tomato_leaf_doctor.db';

interface ScanRow {
  readonly id: number;
  readonly created_at: number;
  readonly image_path: string;
  readonly top_class: string;
  readonly category: string;
  readonly confidence: number;
  readonly low_confidence: number;
  readonly scores_json: string;
  readonly provider: string;
  readonly model_version: string | null;
  readonly class_order_verified: number;
}

/**
 * SQLite-backed scan history. Works fully offline — the whole point, now
 * that inference runs on-device too.
 */
export class SqliteScanRepository implements ScanRepository {
  private db: SQLiteDatabase | null = null;

  async init(): Promise<void> {
    if (this.db !== null) return;
    const { openDatabaseAsync } = await import('expo-sqlite');
    const db = await openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL');

    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const current = row?.user_version ?? 0;

    for (const migration of pendingMigrations(current)) {
      await db.withTransactionAsync(async () => {
        for (const statement of migration.statements) {
          await db.execAsync(statement);
        }
      });
      // PRAGMA cannot be parameterised; the value is an integer literal from
      // our own migration list, never user input.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    }
    if (pendingMigrations(current).length === 0 && current > SCHEMA_VERSION) {
      throw new Error(
        `Database schema version ${current} is newer than this app understands (${SCHEMA_VERSION}). Update the app.`,
      );
    }
    this.db = db;
  }

  async save(scan: NewScan): Promise<SavedScan> {
    const db = this.requireDb();
    const result = await db.runAsync(
      `INSERT INTO scans (created_at, image_path, top_class, category, confidence,
                          low_confidence, scores_json, provider, model_version, class_order_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      scan.createdAt,
      scan.imagePath,
      scan.topClass,
      scan.category,
      scan.confidence,
      scan.lowConfidence ? 1 : 0,
      JSON.stringify(scan.scores),
      scan.provider,
      scan.modelVersion,
      scan.classOrderVerified ? 1 : 0,
    );
    return { ...scan, id: result.lastInsertRowId };
  }

  async list(): Promise<SavedScan[]> {
    const db = this.requireDb();
    const rows = await db.getAllAsync<ScanRow>(
      'SELECT * FROM scans ORDER BY created_at DESC, id DESC',
    );
    return rows.map((row) => toDomain(row));
  }

  async get(id: number): Promise<SavedScan | null> {
    const db = this.requireDb();
    const row = await db.getFirstAsync<ScanRow>('SELECT * FROM scans WHERE id = ?', id);
    return row ? toDomain(row) : null;
  }

  async delete(id: number): Promise<void> {
    const db = this.requireDb();
    await db.runAsync('DELETE FROM scans WHERE id = ?', id);
  }

  async clear(): Promise<void> {
    const db = this.requireDb();
    await db.runAsync('DELETE FROM scans');
  }

  private requireDb(): SQLiteDatabase {
    if (this.db === null) {
      throw new Error('ScanRepository.init() must be called before use.');
    }
    return this.db;
  }
}

/** Row → domain, validating the stored class code rather than trusting it. */
export function toDomain(row: ScanRow): SavedScan {
  if (!isClassCode(row.top_class)) {
    throw new Error(`Stored scan ${row.id} has unknown class "${row.top_class}".`);
  }
  const scores = JSON.parse(row.scores_json) as ClassScore[];
  return {
    id: row.id,
    createdAt: row.created_at,
    imagePath: row.image_path,
    topClass: row.top_class as ClassCode,
    category: row.category as Category,
    confidence: row.confidence,
    lowConfidence: row.low_confidence === 1,
    scores,
    provider: row.provider as InferenceProviderName,
    modelVersion: row.model_version,
    classOrderVerified: row.class_order_verified === 1,
  };
}

export { MIGRATIONS };
