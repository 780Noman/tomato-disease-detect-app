/**
 * Typed access to environment configuration.
 *
 * This module is the ONLY place that reads `process.env.EXPO_PUBLIC_*`.
 * The literal member accesses below matter: Expo inlines these variables
 * statically at build time, so dynamic lookups would silently read nothing.
 */

export const INFERENCE_PROVIDERS = ['mock', 'tflite', 'remote'] as const;
export type InferenceProviderName = (typeof INFERENCE_PROVIDERS)[number];

export interface FirebaseConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
}

export interface Env {
  readonly inferenceProvider: InferenceProviderName;
  readonly remoteApiUrl: string | null;
  /**
   * Null when the Firebase project is not configured. Auth is optional by
   * design — scanning must work without it (see features/auth), so a missing
   * config disables account features rather than breaking the app.
   */
  readonly firebase: FirebaseConfig | null;
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
  readonly EXPO_PUBLIC_FIREBASE_API_KEY?: string;
  readonly EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  readonly EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
  readonly EXPO_PUBLIC_FIREBASE_APP_ID?: string;
}

function isProviderName(value: string): value is InferenceProviderName {
  return (INFERENCE_PROVIDERS as readonly string[]).includes(value);
}

/**
 * The deployed inference server.
 *
 * Committed as a constant rather than read from `.env`, because `.easignore`
 * excludes `.env` from the EAS upload — a release build sees no environment
 * variables at all, so anything that must reach an APK has to live in the
 * source. This is a public endpoint, not a secret.
 *
 * An empty value means "not configured yet". `npm run verify:release` fails
 * while it is empty, so an APK cannot be built without it.
 */
export const DEFAULT_REMOTE_API_URL = '';

/**
 * Server-backed inference is the shipping path (owner decision, 2026-08-10).
 *
 * It was `tflite`. The delivered model cannot run on-device: it was exported
 * with TF Select (Flex) operators that no bundled TFLite runtime can resolve,
 * and the training code needed to re-export it is not available to this
 * project. Diagnosis therefore requires a network connection, which the app
 * states plainly — see features/connectivity.
 *
 * Development and tests select `mock` explicitly via .env / jest.setup.ts; a
 * build that says nothing gets the real provider, not a simulated one.
 */
export const DEFAULT_INFERENCE_PROVIDER: InferenceProviderName = 'remote';

/**
 * @param fallbackRemoteUrl Injected so tests are not coupled to the committed
 *   constant. Production passes the default.
 */
export function readEnv(
  source: EnvSource,
  fallbackRemoteUrl: string = DEFAULT_REMOTE_API_URL,
): Env {
  const provider = source.EXPO_PUBLIC_INFERENCE_PROVIDER ?? DEFAULT_INFERENCE_PROVIDER;
  if (!isProviderName(provider)) {
    throw new EnvError(
      `EXPO_PUBLIC_INFERENCE_PROVIDER must be one of ${INFERENCE_PROVIDERS.join(', ')}; got "${provider}".`,
    );
  }

  // An explicit non-empty env var wins; otherwise fall back to the committed
  // constant. A blank env var is treated as "unset", not as "no server".
  const explicitUrl = source.EXPO_PUBLIC_REMOTE_API_URL?.trim() ?? '';
  const rawUrl = explicitUrl.length > 0 ? explicitUrl : fallbackRemoteUrl.trim();
  const remoteApiUrl = rawUrl.length > 0 ? rawUrl : null;

  // Deliberately NOT thrown when the remote provider has no URL. This runs at
  // module scope, so throwing here white-screens the app before the error
  // boundary exists. The provider factory raises a typed InferenceError
  // instead, which the UI renders as a readable failure.
  if (remoteApiUrl !== null && !/^https?:\/\//.test(remoteApiUrl)) {
    throw new EnvError(
      `EXPO_PUBLIC_REMOTE_API_URL must start with http:// or https://; got "${remoteApiUrl}".`,
    );
  }

  return { inferenceProvider: provider, remoteApiUrl, firebase: readFirebase(source) };
}

/**
 * All four Firebase values are required together. A partial config is a
 * configuration mistake, not a half-working auth setup, so it throws.
 */
function readFirebase(source: EnvSource): FirebaseConfig | null {
  const fields = {
    apiKey: source.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ?? '',
    authDomain: source.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
    projectId: source.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '',
    appId: source.EXPO_PUBLIC_FIREBASE_APP_ID?.trim() ?? '',
  };
  const present = Object.entries(fields).filter(([, value]) => value.length > 0);
  if (present.length === 0) {
    return null;
  }
  if (present.length !== 4) {
    const missing = Object.entries(fields)
      .filter(([, value]) => value.length === 0)
      .map(([key]) => key);
    throw new EnvError(
      `Firebase config is incomplete; missing ${missing.join(', ')}. Set all four EXPO_PUBLIC_FIREBASE_* variables or none.`,
    );
  }
  return fields;
}

export const env: Env = readEnv({
  EXPO_PUBLIC_INFERENCE_PROVIDER: process.env.EXPO_PUBLIC_INFERENCE_PROVIDER,
  EXPO_PUBLIC_REMOTE_API_URL: process.env.EXPO_PUBLIC_REMOTE_API_URL,
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
