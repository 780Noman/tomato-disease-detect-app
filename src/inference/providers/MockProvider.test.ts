import { MockProvider } from './MockProvider';
import { isInferenceError } from '../errors';
import { CLASS_CODES } from '@/config/classes';

async function loadedProvider(): Promise<MockProvider> {
  const provider = new MockProvider();
  await provider.load();
  return provider;
}

describe('MockProvider', () => {
  it('is deterministic: the same URI always yields the same result', async () => {
    const provider = await loadedProvider();
    const a = await provider.run({ imageUri: 'file:///photos/leaf-1.jpg' });
    const b = await provider.run({ imageUri: 'file:///photos/leaf-1.jpg' });
    expect(a.scores).toEqual(b.scores);
  });

  it('covers every class as a top prediction and a low-confidence case across URIs', async () => {
    const provider = await loadedProvider();
    const tops = new Set<string>();
    let sawLowConfidence = false;
    for (let i = 0; i < 64; i += 1) {
      const result = await provider.run({ imageUri: `file:///photos/leaf-${i}.jpg` });
      tops.add(result.top.classCode);
      if (result.lowConfidence) sawLowConfidence = true;
    }
    for (const code of CLASS_CODES) {
      expect(tops).toContain(code);
    }
    expect(sawLowConfidence).toBe(true);
  });

  it('raises the requested typed error for mock://error/ URIs', async () => {
    const provider = await loadedProvider();
    await expect(provider.run({ imageUri: 'mock://error/no-network' })).rejects.toMatchObject({
      code: 'no-network',
    });
    await expect(provider.run({ imageUri: 'mock://error/timeout' })).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('rejects when run before load', async () => {
    const provider = new MockProvider();
    try {
      await provider.run({ imageUri: 'file:///x.jpg' });
      throw new Error('should have rejected');
    } catch (error) {
      expect(isInferenceError(error) && error.code === 'model-not-loaded').toBe(true);
    }
  });

  it('cannot be constructed in a production build', () => {
    const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      expect(() => new MockProvider()).toThrow(/production/);
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
    }
  });
});
