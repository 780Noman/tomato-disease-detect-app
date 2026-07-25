import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components';
import { useSettingsStore, type ThemePreference } from '@/features/settings/settingsStore';
import { spacing } from '@/theme';

const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Follow system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsScreen() {
  const navigation = useNavigation();
  const themePreference = useSettingsStore((s) => s.themePreference);
  const setThemePreference = useSettingsStore((s) => s.setThemePreference);

  return (
    <Screen testID="settings-screen">
      <View style={styles.stack}>
        <Card style={styles.card}>
          <Text variant="heading">Appearance</Text>
          <Text tone="muted">
            Current: {OPTIONS.find((o) => o.value === themePreference)?.label}
          </Text>
          {OPTIONS.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              variant={option.value === themePreference ? 'primary' : 'secondary'}
              onPress={() => setThemePreference(option.value)}
              testID={`theme-${option.value}`}
            />
          ))}
        </Card>

        {__DEV__ ? (
          <Card style={styles.card}>
            <Text variant="heading">Developer</Text>
            <Button
              label="Component gallery"
              variant="ghost"
              onPress={() => navigation.navigate('Gallery')}
              testID="go-gallery"
            />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  card: { gap: spacing.md },
});
