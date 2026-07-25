/**
 * Global test setup (runs after the test framework is installed).
 *
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

// The default provider is the on-device model, which needs native modules and
// a packaged 141 MB model file. Tests select the deterministic mock instead;
// the real providers are covered by their own unit tests.
process.env.EXPO_PUBLIC_INFERENCE_PROVIDER ??= 'mock';
