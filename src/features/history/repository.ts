import type { ScanRepository } from './ScanRepository';

let override: ScanRepository | null = null;
let memoised: Promise<ScanRepository> | null = null;

/** Test hook: inject the in-memory fake. */
export function setScanRepository(repository: ScanRepository | null): void {
  override = repository;
  memoised = null;
}

export function getScanRepository(): Promise<ScanRepository> {
  if (override !== null) {
    return Promise.resolve(override);
  }
  memoised ??= (async () => {
    const { SqliteScanRepository } = await import('./SqliteScanRepository');
    const repository = new SqliteScanRepository();
    await repository.init();
    return repository;
  })();
  return memoised;
}
