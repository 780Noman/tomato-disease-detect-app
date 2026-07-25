import { InferenceError } from './errors';
import type { InferenceProvider } from './InferenceProvider';
import { MockProvider } from './providers/MockProvider';
import { env, type InferenceProviderName } from '@/config/env';

export type { InferenceProvider } from './InferenceProvider';
export type { Classification, ClassScore, InferenceInput } from './types';
export { InferenceError, isInferenceError, messageFor } from './errors';
export type { InferenceErrorCode } from './errors';

/**
 * The only place a concrete provider is chosen. Screens call
 * getInferenceProvider() and know nothing about what is behind it.
 *
 * The tflite/remote providers are code-split behind dynamic import() so
 * their (native) dependencies load only when actually selected; the mock is
 * static so the dev/test path stays free of dynamic import entirely.
 */
export async function createInferenceProvider(
  name: InferenceProviderName = env.inferenceProvider,
): Promise<InferenceProvider> {
  switch (name) {
    case 'mock': {
      if (!__DEV__) {
        throw new InferenceError('mock-in-production');
      }
      return new MockProvider();
    }
    case 'tflite': {
      const { TFLiteProvider } = await import('./providers/TFLiteProvider');
      return new TFLiteProvider();
    }
    case 'remote': {
      if (env.remoteApiUrl === null) {
        throw new InferenceError(
          'server-unreachable',
          'EXPO_PUBLIC_REMOTE_API_URL is not set but the remote provider was requested.',
        );
      }
      const { RemoteProvider } = await import('./providers/RemoteProvider');
      return new RemoteProvider(env.remoteApiUrl);
    }
    default: {
      const unreachable: never = name;
      return unreachable;
    }
  }
}

let memoised: Promise<InferenceProvider> | null = null;

export function getInferenceProvider(): Promise<InferenceProvider> {
  memoised ??= createInferenceProvider();
  return memoised;
}

/** Test hook. */
export function resetInferenceProvider(): void {
  memoised = null;
}
