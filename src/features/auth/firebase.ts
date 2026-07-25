import type { Auth, Persistence } from 'firebase/auth';

import { env } from '@/config/env';

export class AuthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthUnavailableError';
  }
}

/**
 * `getReactNativePersistence` ships in Firebase's react-native build but is
 * not declared in the package's public types (`auth-public.d.ts`), so it is
 * resolved at runtime and narrowed here instead of with a `@ts-ignore`.
 * When it is absent — web, tests, or a future SDK change — auth still works,
 * just without session persistence across restarts.
 */
interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type PersistenceFactory = (storage: AsyncStorageLike) => Persistence;

let cached: Promise<Auth> | null = null;

async function createAuth(): Promise<Auth> {
  const config = env.firebase;
  if (config === null) {
    throw new AuthUnavailableError(
      'Firebase is not configured in this build (EXPO_PUBLIC_FIREBASE_* are unset), so account features are unavailable. Scanning, history and reports work without an account.',
    );
  }

  const { getApp, getApps, initializeApp } = await import('firebase/app');
  const app = getApps().length > 0 ? getApp() : initializeApp(config);

  const authModule = await import('firebase/auth');
  const factory = (authModule as unknown as { getReactNativePersistence?: PersistenceFactory })
    .getReactNativePersistence;

  if (factory === undefined) {
    return authModule.initializeAuth(app);
  }
  const AsyncStorage = (await import('@react-native-async-storage/async-storage'))
    .default as unknown as AsyncStorageLike;
  return authModule.initializeAuth(app, { persistence: factory(AsyncStorage) });
}

export function getFirebaseAuth(): Promise<Auth> {
  cached ??= createAuth();
  return cached;
}

/** Test hook. */
export function resetFirebaseAuth(): void {
  cached = null;
}

export function isAuthConfigured(): boolean {
  return env.firebase !== null;
}
