import { useEffect, useState } from 'react';

/**
 * Network reachability, used only to explain remote-path failures and to
 * reassure the user that scanning works offline. Nothing in the app blocks
 * on connectivity: on-device inference, history, library and reports are all
 * offline-capable.
 */
export function useNetworkStatus(): { online: boolean | null } {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const NetInfo = (await import('@react-native-community/netinfo')).default;
        const state = await NetInfo.fetch();
        if (!active) return;
        setOnline(state.isConnected === true);
        unsubscribe = NetInfo.addEventListener((next) => {
          setOnline(next.isConnected === true);
        });
      } catch {
        // Reachability is a nicety; if the module is unavailable, stay silent
        // rather than claiming a state we do not know.
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
