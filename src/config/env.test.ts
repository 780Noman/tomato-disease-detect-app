import { EnvError, readEnv } from './env';

describe('readEnv', () => {
  it('defaults to the mock provider with no remote url and no firebase config', () => {
    expect(readEnv({})).toEqual({
      inferenceProvider: 'mock',
      remoteApiUrl: null,
      firebase: null,
    });
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
