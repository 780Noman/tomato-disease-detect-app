import { create } from 'zustand';

import type { ColorScheme } from '@/theme';

export type ThemePreference = 'system' | ColorScheme;

interface SettingsState {
  readonly themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themePreference: 'system',
  setThemePreference: (themePreference) => set({ themePreference }),
}));
