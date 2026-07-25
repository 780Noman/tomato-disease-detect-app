import { create } from 'zustand';

import { AuthUnavailableError, getFirebaseAuth, isAuthConfigured } from './firebase';

export type AuthAccount = {
  readonly uid: string;
  readonly email: string | null;
  readonly isAnonymous: boolean;
};

type AuthStatus = 'idle' | 'working' | 'signed-in' | 'signed-out' | 'error';

interface AuthState {
  readonly status: AuthStatus;
  readonly account: AuthAccount | null;
  readonly error: string | null;
  /**
   * True once the user has chosen to continue without an account. Nothing in
   * the app blocks on this — it only silences the account prompt.
   */
  readonly skipped: boolean;
  signInAnonymously: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  skip: () => void;
  clearError: () => void;
}

/** Firebase error codes → messages a farmer can act on (CLAUDE.md §9). */
export function authMessage(error: unknown): string {
  if (error instanceof AuthUnavailableError) {
    return error.message;
  }
  const code = (error as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/network-request-failed':
      return 'No connection to the sign-in service. You can keep scanning offline — an account is only needed to sync.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/weak-password':
      return 'Choose a password of at least six characters.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email. Sign in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password combination was not recognised.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes before trying again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for the project. Ask the app administrator to enable it.';
    default:
      return 'Sign-in failed. You can continue without an account — scanning does not require one.';
  }
}

function toAccount(user: { uid: string; email: string | null; isAnonymous: boolean }): AuthAccount {
  return { uid: user.uid, email: user.email, isAnonymous: user.isAnonymous };
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  account: null,
  error: null,
  skipped: false,

  signInAnonymously: async () => {
    set({ status: 'working', error: null });
    try {
      const auth = await getFirebaseAuth();
      const { signInAnonymously } = await import('firebase/auth');
      const credential = await signInAnonymously(auth);
      set({ status: 'signed-in', account: toAccount(credential.user), error: null });
    } catch (error) {
      set({ status: 'error', error: authMessage(error) });
    }
  },

  signInWithEmail: async (email, password) => {
    set({ status: 'working', error: null });
    try {
      const auth = await getFirebaseAuth();
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      set({ status: 'signed-in', account: toAccount(credential.user), error: null });
    } catch (error) {
      set({ status: 'error', error: authMessage(error) });
    }
  },

  registerWithEmail: async (email, password) => {
    set({ status: 'working', error: null });
    try {
      const auth = await getFirebaseAuth();
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      set({ status: 'signed-in', account: toAccount(credential.user), error: null });
    } catch (error) {
      set({ status: 'error', error: authMessage(error) });
    }
  },

  signOut: async () => {
    set({ status: 'working', error: null });
    try {
      const auth = await getFirebaseAuth();
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
      set({ status: 'signed-out', account: null, error: null });
    } catch (error) {
      set({ status: 'error', error: authMessage(error) });
    }
  },

  skip: () => set({ skipped: true, status: 'signed-out', error: null }),
  clearError: () => set({ error: null }),
}));

export { isAuthConfigured };
