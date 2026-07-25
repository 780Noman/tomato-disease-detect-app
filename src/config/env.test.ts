import { EnvError, readEnv } from './env';

describe('readEnv', () => {
  it('defaults to the on-device provider — an unconfigured build gets the real model, not a mock', () => {
    expect(readEnv({})).toEqual({
      inferenceProvider: 'tflite',
      remoteApiUrl: null,
      firebase: null,
    });
  });

  it('lets an explicit mock selection override the default (dev and tests)', () => {
    expect(readEnv({ EXPO_PUBLIC_INFERENCE_PROVIDER: 'mock' }).inferenceProvider).toBe('mock');
  });

  it.each(['mock', 'tflite', 'remote'] as const)('accepts provider "%s"', (name) => {
    const source = {
      EXPO_PUBLIC_INFERENCE_PROVIDER: name,
      EXPO_PUBLIC_REMOTE_API_URL: 'http://127.0.0.1:8000',
    };
    expect(readEnv(source).inferenceProvider).toBe(name);
  });

  it('rejects an unknown provider name', () => {
    expect(() => readEnv({ EXPO_PUBLIC_INFERENCE_PROVIDER: 'yolo' })).toThrow(EnvError);
  });

  it('requires the remote url when the provider is remote', () => {
    expect(() => readEnv({ EXPO_PUBLIC_INFERENCE_PROVIDER: 'remote' })).toThrow(
      /EXPO_PUBLIC_REMOTE_API_URL is required/,
    );
  });

  it('treats a blank remote url as absent', () => {
    expect(readEnv({ EXPO_PUBLIC_REMOTE_API_URL: '   ' }).remoteApiUrl).toBeNull();
  });

  it('rejects a remote url without an http scheme', () => {
    expect(() => readEnv({ EXPO_PUBLIC_REMOTE_API_URL: '192.168.0.10:8000' })).toThrow(EnvError);
  });

  it('keeps a valid remote url', () => {
    const source = { EXPO_PUBLIC_REMOTE_API_URL: 'https://example.com' };
    expect(readEnv(source).remoteApiUrl).toBe('https://example.com');
  });
});
