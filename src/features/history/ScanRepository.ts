import type { NewScan, SavedScan } from './types';

/** Storage seam. Features depend on this, never on SQLite directly. */
export interface ScanRepository {
  init(): Promise<void>;
  save(scan: NewScan): Promise<SavedScan>;
  list(): Promise<SavedScan[]>;
  get(id: number): Promise<SavedScan | null>;
  delete(id: number): Promise<void>;
  clear(): Promise<void>;
}
