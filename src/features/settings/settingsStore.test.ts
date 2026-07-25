import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ themePreference: 'system' });
  });

  it('defaults to following the system scheme', () => {
    expect(useSettingsStore.getState().themePreference).toBe('system');
  });

  it('stores an explicit preference', () => {
    useSettingsStore.getState().setThemePreference('dark');
    expect(useSettingsStore.getState().themePreference).toBe('dark');
  });
});
