import type { ScanRepository } from './ScanRepository';
import type { NewScan, SavedScan } from './types';

/** Test/dev fake with the same contract as the SQLite implementation. */
export class InMemoryScanRepository implements ScanRepository {
  private scans: SavedScan[] = [];

  private nextId = 1;

  init(): Promise<void> {
    return Promise.resolve();
  }

  save(scan: NewScan): Promise<SavedScan> {
    const saved: SavedScan = { ...scan, id: this.nextId };
    this.nextId += 1;
    this.scans.push(saved);
    return Promise.resolve(saved);
  }

  list(): Promise<SavedScan[]> {
    const sorted = [...this.scans].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
    return Promise.resolve(sorted);
  }

  get(id: number): Promise<SavedScan | null> {
    return Promise.resolve(this.scans.find((s) => s.id === id) ?? null);
  }

  delete(id: number): Promise<void> {
    this.scans = this.scans.filter((s) => s.id !== id);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.scans = [];
    return Promise.resolve();
  }
}
