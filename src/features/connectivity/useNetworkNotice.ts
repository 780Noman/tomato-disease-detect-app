import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * Shows the "diagnosis needs the internet" explanation exactly once per
 * install.
 *
 * WHY IT EXISTS: diagnosis is server-backed (the model cannot run on-device —
 * see config/env.ts), so the app is useless offline for its main task. Anyone
 * who first opens it without a connection would reasonably conclude the app is
 * broken. Saying so up front, once, is the difference between a known
 * limitation and an apparent bug.
 *
 * WHY NOT AN ALERT ON EVERY LAUNCH: a dialog the user has to dismiss each time
 * trains them to dismiss it without reading. This fires once; the live
 * NetworkNotice banner carries the message from then on, only when it is
 * actually relevant.
 *
 * AsyncStorage is imported statically, unlike the dynamic-import pattern used
 * elsewhere for genuinely optional native modules. `await import()` throws
 * under this Jest configuration, so a dynamic import here would make every test
 * take the catch branch — the storage path would be permanently untested and
 * would behave differently in tests than on a device. That divergence is the
 * exact shape of bug that has already cost two build cycles.
 */

/** Exported so tests can seed or clear it instead of duplicating the string. */
export const NETWORK_NOTICE_STORAGE_KEY = 'tld.networkNotice.seen.v1';

export interface NetworkNoticeState {
  /** Null while the stored flag is still being read — render nothing yet. */
  readonly visible: boolean | null;
  readonly dismiss: () => void;
}

export function useNetworkNotice(): NetworkNoticeState {
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const seen = await AsyncStorage.getItem(NETWORK_NOTICE_STORAGE_KEY);
        if (active) setVisible(seen === null);
      } catch {
        // Storage is unavailable. Showing the notice again is harmless;
        // suppressing it could leave a first-time user with no explanation at
        // all, so failure errs towards showing it.
        if (active) setVisible(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    void AsyncStorage.setItem(NETWORK_NOTICE_STORAGE_KEY, 'true').catch(() => {
      // The notice stays dismissed for this session either way.
    });
  }, []);

  return { visible, dismiss };
}
