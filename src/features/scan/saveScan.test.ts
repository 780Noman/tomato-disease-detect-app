import { buildScanToSave } from './saveScan';
import { CLASS_ORDER_VERIFIED } from '@/config/classes';
import type { Classification } from '@/inference';

jest.mock('@/features/history/scanImage', () => ({
  persistScanImage: jest.fn().mockResolvedValue('file:///documents/scans/scan-42.jpg'),
  deleteScanImage: jest.fn(),
}));

const RESULT: Classification = {
  scores: [
    { classCode: 'tomato__N', probability: 0.66 },
    { classCode: 'tomato__N_K', probability: 0.18 },
    { classCode: 'tomato__K', probability: 0.09 },
    { classCode: 'tomato__LM', probability: 0.03 },
    { classCode: 'tomato__MIT', probability: 0.02 },
    { classCode: 'tomato__JAS_MIT', probability: 0.02 },
  ],
  top: { classCode: 'tomato__N', probability: 0.66 },
  lowConfidence: false,
  provider: 'mock',
  modelVersion: 'mock',
  durationMs: 12,
};

describe('buildScanToSave', () => {
  it('derives the category from config, never from the screen', async () => {
    const scan = await buildScanToSave('file:///cache/photo.jpg', RESULT, 1000);
    expect(scan.category).toBe('nutrient-deficiency');
    expect(scan.topClass).toBe('tomato__N');
  });

  it('stores the copied image path, not the volatile camera cache path', async () => {
    const scan = await buildScanToSave('file:///cache/photo.jpg', RESULT, 1000);
    expect(scan.imagePath).toBe('file:///documents/scans/scan-42.jpg');
  });

  it('keeps the full six-class vector', async () => {
    const scan = await buildScanToSave('file:///cache/photo.jpg', RESULT, 1000);
    expect(scan.scores).toHaveLength(6);
  });

  it('stamps the class-order verification state of the build', async () => {
    const scan = await buildScanToSave('file:///cache/photo.jpg', RESULT, 1000);
    expect(scan.classOrderVerified).toBe(CLASS_ORDER_VERIFIED);
  });
});
