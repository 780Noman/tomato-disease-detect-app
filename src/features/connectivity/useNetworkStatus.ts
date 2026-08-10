import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Network reachability.
 *
 * Since 2026-08-10 this is load-bearing, not a nicety: diagnosis is
 * server-backed (the model cannot run on-device), so being offline is the
 * difference between a working scan and no scan. NetworkNotice renders from
 * this, which is why it must be testable.
 *
 * NetInfo is imported statically. It used to be a dynamic import, but
 * `await import()` throws under this Jest configuration, so every test took the
 * catch branch and `online` was permanently null — the offline banner could
 * never be exercised by a test even though it is the whole point of the
 * feature. NetInfo is a declared, autolinked dependency, so a static import is
 * safe in a build and honest in tests.
 *
 * `null` means "not known yet". Callers must not treat it as offline: claiming
 * a state before NetInfo has answered would be a guess.
 */
/**
 * NetInfo reports `isConnected` as boolean OR null, where null means "not
 * determined". Collapsing null to false would render an "Offline" warning over
 * a perfectly good connection, which reads as a broken app — so unknown stays
 * unknown and the UI shows nothing.
 */
export function toOnlineState(isConnected: boolean | null | undefined): boolean | null {
  if (isConnected === true) return true;
  if (isConnected === false) return false;
  return null;
}

export function useNetworkStatus(): { online: boolean | null } {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const state = await NetInfo.fetch();
        if (!active) return;
        setOnline(toOnlineState(state.isConnected));
        unsubscribe = NetInfo.addEventListener((next) => {
          setOnline(toOnlineState(next.isConnected));
        });
      } catch {
        // Stay at "unknown" rather than claiming a state we do not have.
        if (active) setOnline(null);
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return { online };
}
