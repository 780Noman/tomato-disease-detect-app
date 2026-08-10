import { DEFAULT_REMOTE_API_URL, EnvError, readEnv } from './env';

// Most cases pin the fallback URL explicitly so they stay true whatever the
// committed DEFAULT_REMOTE_API_URL happens to be.
const NO_FALLBACK = '';

describe('readEnv', () => {
  it('defaults to the server-backed provider — an unconfigured build gets the real path, not a mock', () => {
    expect(readEnv({}, NO_FALLBACK)).toEqual({
      inferenceProvider: 'remote',
      remoteApiUrl: null,
      firebase: null,
    });
  });

  it('uses the committed default server URL when no env var is set', () => {
    expect(readEnv({}, 'https://example.hf.space').remoteApiUrl).toBe('https://example.hf.space');
  });

  it('lets an env var override the committed default', () => {
    const source = { EXPO_PUBLIC_REMOTE_API_URL: 'http://127.0.0.1:8000' };
    expect(readEnv(source, 'https://example.hf.space').remoteApiUrl).toBe('http://127.0.0.1:8000');
  });

  it('falls back to the committed default when the env var is blank', () => {
    const source = { EXPO_PUBLIC_REMOTE_API_URL: '   ' };
    expect(readEnv(source, 'https://example.hf.space').remoteApiUrl).toBe(
      'https://example.hf.space',
    );
  });

  it('ships a DEFAULT_REMOTE_API_URL that is either empty or a valid http(s) URL', () => {
    // Empty is the "not configured yet" state, which verify:release blocks.
    // Anything non-empty must be usable, or every scan fails in the field.
    if (DEFAULT_REMOTE_API_URL.length > 0) {
      expect(DEFAULT_REMOTE_API_URL).toMatch(/^https?:\/\/\S+$/);
      expect(DEFAULT_REMOTE_API_URL).not.toMatch(/\/$/); // trailing slash doubles axios paths
    }
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

  it('does NOT throw when the remote provider has no url', () => {
    // readEnv runs at module scope. Throwing here would white-screen the app
    // before the error boundary mounts; the provider factory reports it as a
    // typed InferenceError the UI can render instead.
    expect(readEnv({ EXPO_PUBLIC_INFERENCE_PROVIDER: 'remote' }, NO_FALLBACK)).toMatchObject({
      inferenceProvider: 'remote',
      remoteApiUrl: null,
    });
  });

  it('treats a blank remote url with no fallback as absent', () => {
    expect(readEnv({ EXPO_PUBLIC_REMOTE_API_URL: '   ' }, NO_FALLBACK).remoteApiUrl).toBeNull();
  });

  it('rejects a remote url without an http scheme', () => {
    expect(() => readEnv({ EXPO_PUBLIC_REMOTE_API_URL: '192.168.0.10:8000' })).toThrow(EnvError);
  });

  it('rejects a committed fallback url without an http scheme', () => {
    expect(() => readEnv({}, 'my-space.hf.space')).toThrow(EnvError);
  });

  it('keeps a valid remote url', () => {
    const source = { EXPO_PUBLIC_REMOTE_API_URL: 'https://example.com' };
    expect(readEnv(source).remoteApiUrl).toBe('https://example.com');
  });
});
