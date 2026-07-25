import { render } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme';
import type { ColorScheme } from '@/theme';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function renderWithTheme(ui: ReactElement, scheme: ColorScheme = 'light') {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider forcedScheme={scheme}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}
