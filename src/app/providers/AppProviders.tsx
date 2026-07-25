import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '../ErrorBoundary';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { ThemeProvider, themeForScheme, useTheme } from '@/theme';

/** Maps our theme roles onto React Navigation's theme shape. */
function navigationTheme(scheme: 'light' | 'dark'): NavTheme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const t = themeForScheme(scheme);
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: t.color.primary,
      background: t.color.surface,
      card: t.color.surface,
      text: t.color.text,
      border: t.color.border,
      notification: t.color.danger,
    },
  };
}

function NavigationRoot({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <NavigationContainer theme={navigationTheme(theme.scheme)}>{children}</NavigationContainer>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const themePreference = useSettingsStore((s) => s.themePreference);
  const forcedScheme = themePreference === 'system' ? undefined : themePreference;

  return (
    <SafeAreaProvider>
      <ThemeProvider forcedScheme={forcedScheme}>
        <ErrorBoundary>
          <NavigationRoot>{children}</NavigationRoot>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
