import { useHistoryStore } from './historyStore';
import { InMemoryScanRepository } from './InMemoryScanRepository';
import { setScanRepository } from './repository';
import type { NewScan } from './types';

jest.mock('./scanImage', () => ({
  persistScanImage: jest.fn().mockResolvedValue('file:///scans/copy.jpg'),
  deleteScanImage: jest.fn().mockResolvedValue(undefined),
}));

const SCAN: NewScan = {
  createdAt: 1_700_000_000_000,
  imagePath: 'file:///scans/scan-1.jpg',
  topClass: 'tomato__MIT',
  category: 'insect-pest',
  confidence: 0.77,
  lowConfidence: false,
  scores: [
    { classCode: 'tomato__MIT', probability: 0.77 },
    { classCode: 'tomato__LM', probability: 0.12 },
    { classCode: 'tomato__JAS_MIT', probability: 0.05 },
    { classCode: 'tomato__K', probability: 0.03 },
    { classCode: 'tomato__N', probability: 0.02 },
    { classCode: 'tomato__N_K', probability: 0.01 },
  ],
  provider: 'mock',
  modelVersion: 'mock',
  classOrderVerified: false,
};

describe('historyStore', () => {
  beforeEach(() => {
    setScanRepository(new InMemoryScanRepository());
    useHistoryStore.setState({ status: 'idle', scans: [], error: null });
  });

  afterAll(() => {
    setScanRepository(null);
  });

  it('loads to a ready state', async () => {
    await useHistoryStore.getState().load();
    expect(useHistoryStore.getState().status).toBe('ready');
    expect(useHistoryStore.getState().error).toBeNull();
  });

  it('saves a scan and puts it at the head of the list', async () => {
    await useHistoryStore.getState().load();
    const saved = await useHistoryStore.getState().save(SCAN);
    expect(saved).not.toBeNull();
    expect(useHistoryStore.getState().scans[0]?.topClass).toBe('tomato__MIT');
  });

  it('removes a scan', async () => {
    await useHistoryStore.getState().load();
    const saved = await useHistoryStore.getState().save(SCAN);
    await useHistoryStore.getState().remove(saved?.id ?? 0);
    expect(useHistoryStore.getState().scans).toHaveLength(0);
  });

  it('surfaces a repository failure as an error state, never a silent empty list', async () => {
    const broken = new InMemoryScanRepository();
    jest.spyOn(broken, 'list').mockRejectedValue(new Error('database is locked'));
    setScanRepository(broken);

    await useHistoryStore.getState().load();
    expect(useHistoryStore.getState().status).toBe('error');
    expect(useHistoryStore.getState().error).toBe('database is locked');
  });

  it('reports a save failure without losing the diagnosis', async () => {
    const broken = new InMemoryScanRepository();
    jest.spyOn(broken, 'save').mockRejectedValue(new Error('disk full'));
    setScanRepository(broken);

    expect(await useHistoryStore.getState().save(SCAN)).toBeNull();
    expect(useHistoryStore.getState().error).toBe('disk full');
  });
});
