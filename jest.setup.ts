/**
 * Global test setup (runs after the test framework is installed).
 *
 * The jest.mock() calls below are hoisted above these imports by Babel, so
 * AsyncStorage and anything reached through it resolve to the mocks.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { NETWORK_NOTICE_STORAGE_KEY } from '@/features/connectivity/useNetworkNotice';

/**
 * SafeAreaProvider defers rendering children until it has measured window
 * insets — a measurement that never happens in the RN test environment. The
 * library ships an official mock with fixed metrics; installing it globally
 * means every screen test sees real content.
 */
jest.mock(
  'react-native-safe-area-context',
  () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-safe-area-context/jest/mock').default,
);

// AsyncStorage's native module does not exist in the test environment, so the
// library's official in-memory mock stands in for it.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// NetInfo has no native module in tests either. Its official mock reports a
// connected state, so screens render their online (normal) path by default;
// tests that care about being offline override NetInfo.fetch.
jest.mock('@react-native-community/netinfo', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);

// The default provider is server-backed and needs a live network. Tests select
// the deterministic mock instead; the real providers are covered by their own
// unit tests.
process.env.EXPO_PUBLIC_INFERENCE_PROVIDER ??= 'mock';

// Screen tests run in the steady state: the one-time "diagnosis needs the
// internet" notice has already been seen. It is a modal, so leaving it visible
// would hide every screen behind it from accessibility queries — which is
// exactly what it should do to a real user, and useless in a navigation test.
// Its own first-run behaviour is covered in
// src/features/connectivity/useNetworkNotice.test.tsx, which clears this key.
beforeEach(async () => {
  await AsyncStorage.setItem(NETWORK_NOTICE_STORAGE_KEY, 'true');
});
