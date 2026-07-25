import { authMessage, useAuthStore } from './authStore';
import { AuthUnavailableError } from './firebase';

describe('authMessage', () => {
  it('explains a network failure and reassures that scanning still works', () => {
    expect(authMessage({ code: 'auth/network-request-failed' })).toMatch(/keep scanning offline/i);
  });

  it('maps each credential failure to its own actionable message', () => {
    expect(authMessage({ code: 'auth/invalid-email' })).toMatch(/not valid/i);
    expect(authMessage({ code: 'auth/weak-password' })).toMatch(/six characters/i);
    expect(authMessage({ code: 'auth/email-already-in-use' })).toMatch(/Sign in instead/i);
    expect(authMessage({ code: 'auth/wrong-password' })).toMatch(/not recognised/i);
    expect(authMessage({ code: 'auth/too-many-requests' })).toMatch(/Wait a few minutes/i);
  });

  it('passes through the unavailable-config explanation', () => {
    const error = new AuthUnavailableError('Firebase is not configured in this build.');
    expect(authMessage(error)).toBe('Firebase is not configured in this build.');
  });

  it('never says only "something went wrong"', () => {
    const fallback = authMessage({ code: 'auth/some-future-code' });
    expect(fallback).not.toMatch(/^something went wrong/i);
    expect(fallback).toMatch(/without an account/i);
  });
});

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'idle', account: null, error: null, skipped: false });
  });

  it('starts with no account — nothing waits on sign-in', () => {
    const state = useAuthStore.getState();
    expect(state.account).toBeNull();
    expect(state.status).toBe('idle');
  });

  it('records the skip choice without blocking anything', () => {
    useAuthStore.getState().skip();
    expect(useAuthStore.getState().skipped).toBe(true);
    expect(useAuthStore.getState().status).toBe('signed-out');
  });

  it('surfaces an unconfigured Firebase project as a readable error, not a crash', async () => {
    // Tests run with no EXPO_PUBLIC_FIREBASE_* set, so this is the real path.
    await useAuthStore.getState().signInAnonymously();
    const state = useAuthStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toMatch(/not configured/i);
    expect(state.error).toMatch(/work without an account/i);
    expect(state.account).toBeNull();
  });

  it('clears an error on request', () => {
    useAuthStore.setState({ error: 'boom' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
