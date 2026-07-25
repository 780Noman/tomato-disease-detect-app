import { MIGRATIONS, pendingMigrations, SCHEMA_VERSION } from './migrations';

describe('migration runner planning', () => {
  it('exposes a schema version matching the highest migration', () => {
    expect(SCHEMA_VERSION).toBe(Math.max(...MIGRATIONS.map((m) => m.version)));
  });

  it('uses unique, gapless, 1-based version numbers', () => {
    const versions = MIGRATIONS.map((m) => m.version).sort((a, b) => a - b);
    expect(versions).toEqual(versions.map((_, index) => index + 1));
  });

  it('runs everything on a fresh database', () => {
    expect(pendingMigrations(0).map((m) => m.version)).toEqual([1]);
  });

  it('runs nothing on an up-to-date database', () => {
    expect(pendingMigrations(SCHEMA_VERSION)).toEqual([]);
  });

  it('runs only newer migrations on a partially-migrated database', () => {
    expect(pendingMigrations(1).every((m) => m.version > 1)).toBe(true);
  });

  it('returns migrations in ascending order', () => {
    const versions = pendingMigrations(0).map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
  });
});
