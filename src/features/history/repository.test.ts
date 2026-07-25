import { InMemoryScanRepository } from './InMemoryScanRepository';
import type { ScanRepository } from './ScanRepository';
import type { NewScan } from './types';

function makeScan(overrides: Partial<NewScan> = {}): NewScan {
  return {
    createdAt: 1_700_000_000_000,
    imagePath: 'file:///scans/scan-1.jpg',
    topClass: 'tomato__LM',
    category: 'insect-pest',
    confidence: 0.82,
    lowConfidence: false,
    scores: [
      { classCode: 'tomato__LM', probability: 0.82 },
      { classCode: 'tomato__MIT', probability: 0.1 },
      { classCode: 'tomato__JAS_MIT', probability: 0.03 },
      { classCode: 'tomato__K', probability: 0.02 },
      { classCode: 'tomato__N', probability: 0.02 },
      { classCode: 'tomato__N_K', probability: 0.01 },
    ],
    provider: 'mock',
    modelVersion: 'mock',
    classOrderVerified: false,
    ...overrides,
  };
}

/**
 * Contract tests. The in-memory fake and the SQLite implementation must
 * behave identically; only the fake runs under Jest (SQLite needs native
 * modules), so this pins the contract both are written against.
 */
describe('ScanRepository contract (in-memory)', () => {
  let repository: ScanRepository;

  beforeEach(async () => {
    repository = new InMemoryScanRepository();
    await repository.init();
  });

  it('saves and returns a scan with an id', async () => {
    const saved = await repository.save(makeScan());
    expect(saved.id).toBeGreaterThan(0);
    expect(saved.topClass).toBe('tomato__LM');
  });

  it('persists the FULL probability vector, not just the winner', async () => {
    const saved = await repository.save(makeScan());
    const fetched = await repository.get(saved.id);
    expect(fetched?.scores).toHaveLength(6);
  });

  it('records whether the class order was verified at scan time', async () => {
    const saved = await repository.save(makeScan({ classOrderVerified: false }));
    expect((await repository.get(saved.id))?.classOrderVerified).toBe(false);
  });

  it('lists newest first', async () => {
    await repository.save(makeScan({ createdAt: 1000 }));
    await repository.save(makeScan({ createdAt: 3000 }));
    await repository.save(makeScan({ createdAt: 2000 }));
    expect((await repository.list()).map((s) => s.createdAt)).toEqual([3000, 2000, 1000]);
  });

  it('returns null for an unknown id rather than throwing', async () => {
    expect(await repository.get(9999)).toBeNull();
  });

  it('deletes one scan and leaves the rest', async () => {
    const a = await repository.save(makeScan({ createdAt: 1000 }));
    await repository.save(makeScan({ createdAt: 2000 }));
    await repository.delete(a.id);
    const remaining = await repository.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.createdAt).toBe(2000);
  });

  it('clears everything', async () => {
    await repository.save(makeScan());
    await repository.clear();
    expect(await repository.list()).toEqual([]);
  });

  it('keeps a low-confidence scan marked as such', async () => {
    const saved = await repository.save(makeScan({ lowConfidence: true, confidence: 0.31 }));
    expect((await repository.get(saved.id))?.lowConfidence).toBe(true);
  });
});
