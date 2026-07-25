import { EnvError, readEnv } from './env';

const FULL = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'app.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'app',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:2:web:3',
};

describe('readEnv — Firebase config', () => {
  it('is null when nothing is set (auth is optional)', () => {
    expect(readEnv({}).firebase).toBeNull();
  });

  it('reads a complete config', () => {
    expect(readEnv(FULL).firebase).toEqual({
      apiKey: 'key',
      authDomain: 'app.firebaseapp.com',
      projectId: 'app',
      appId: '1:2:web:3',
    });
  });

  it('rejects a partial config, naming what is missing', () => {
    const { EXPO_PUBLIC_FIREBASE_APP_ID: _omitted, ...partial } = FULL;
    expect(() => readEnv(partial)).toThrow(EnvError);
    expect(() => readEnv(partial)).toThrow(/appId/);
  });

  it('treats whitespace-only values as unset', () => {
    expect(readEnv({ EXPO_PUBLIC_FIREBASE_API_KEY: '   ' }).firebase).toBeNull();
  });
});
