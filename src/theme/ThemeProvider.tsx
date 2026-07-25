import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { themeForScheme, type ColorScheme, type Theme } from './theme';

const ThemeContext = createContext<Theme | null>(null);

interface ThemeProviderProps {
  readonly children: ReactNode;
  /** Pin the scheme (tests, the gallery's toggle); defaults to the OS. */
  readonly forcedScheme?: ColorScheme;
}

export function ThemeProvider({ children, forcedScheme }: ThemeProviderProps) {
  const osScheme = useColorScheme();
  const scheme: ColorScheme = forcedScheme ?? (osScheme === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => themeForScheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error('useTheme must be used inside a ThemeProvider.');
  }
  return theme;
}
