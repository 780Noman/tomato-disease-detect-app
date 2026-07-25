import { createInferenceProvider, getInferenceProvider, resetInferenceProvider } from './index';

describe('inference factory', () => {
  afterEach(() => {
    resetInferenceProvider();
  });

  it('creates the mock provider in dev', async () => {
    const provider = await createInferenceProvider('mock');
    expect(provider.name).toBe('mock');
  });

  it('refuses the mock provider outside dev', async () => {
    const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      await expect(createInferenceProvider('mock')).rejects.toMatchObject({
        code: 'mock-in-production',
      });
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
    }
  });

  // The tflite branch is behind dynamic import(), which Jest cannot execute;
  // TFLiteProvider itself is covered in providers/TFLiteProvider.test.ts and
  // the factory branch is exercised on-device.

  it('refuses the remote provider when no URL is configured', async () => {
    // env defaults have no EXPO_PUBLIC_REMOTE_API_URL in tests.
    await expect(createInferenceProvider('remote')).rejects.toMatchObject({
      code: 'server-unreachable',
    });
  });

  it('memoises the default provider', async () => {
    const a = await getInferenceProvider();
    const b = await getInferenceProvider();
    expect(a).toBe(b);
  });
});
