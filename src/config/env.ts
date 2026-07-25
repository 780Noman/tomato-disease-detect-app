/**
 * Typed access to environment configuration.
 *
 * This module is the ONLY place that reads `process.env.EXPO_PUBLIC_*`.
 * The literal member accesses below matter: Expo inlines these variables
 * statically at build time, so dynamic lookups would silently read nothing.
 */

export const INFERENCE_PROVIDERS = ['mock', 'tflite', 'remote'] as const;
export type InferenceProviderName = (typeof INFERENCE_PROVIDERS)[number];

export interface Env {
  readonly inferenceProvider: InferenceProviderName;
  readonly remoteApiUrl: string | null;
}

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

export interface EnvSource {
  readonly EXPO_PUBLIC_INFERENCE_PROVIDER?: string;
  readonly EXPO_PUBLIC_REMOTE_API_URL?: string;
}

function isProviderName(value: string): value is InferenceProviderName {
  return (INFERENCE_PROVIDERS as readonly string[]).includes(value);
}

export function readEnv(source: EnvSource): Env {
  const provider = source.EXPO_PUBLIC_INFERENCE_PROVIDER ?? 'mock';
  if (!isProviderName(provider)) {
    throw new EnvError(
      `EXPO_PUBLIC_INFERENCE_PROVIDER must be one of ${INFERENCE_PROVIDERS.join(', ')}; got "${provider}".`,
    );
  }

  const rawUrl = source.EXPO_PUBLIC_REMOTE_API_URL?.trim();
  const remoteApiUrl = rawUrl ? rawUrl : null;

  if (provider === 'remote' && remoteApiUrl === null) {
    throw new EnvError(
      'EXPO_PUBLIC_REMOTE_API_URL is required when EXPO_PUBLIC_INFERENCE_PROVIDER is "remote".',
    );
  }
  if (remoteApiUrl !== null && !/^https?:\/\//.test(remoteApiUrl)) {
    throw new EnvError(
      `EXPO_PUBLIC_REMOTE_API_URL must start with http:// or https://; got "${remoteApiUrl}".`,
    );
  }

  return { inferenceProvider: provider, remoteApiUrl };
}

export const env: Env = readEnv({
  EXPO_PUBLIC_INFERENCE_PROVIDER: process.env.EXPO_PUBLIC_INFERENCE_PROVIDER,
  EXPO_PUBLIC_REMOTE_API_URL: process.env.EXPO_PUBLIC_REMOTE_API_URL,
});
