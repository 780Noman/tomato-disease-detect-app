import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Screen, Text } from '@/components';
import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/authStore';
import { useNetworkStatus } from '@/features/connectivity/useNetworkStatus';
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
  const account = useAuthStore((s) => s.account);
  const { online } = useNetworkStatus();
  const onDevice = env.inferenceProvider === 'tflite';

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

        <Card style={styles.card}>
          <Text variant="heading">Account</Text>
          <Text tone="muted">
            {account === null
              ? 'Not signed in. Scanning, history, the library and reports all work without an account.'
              : account.isAnonymous
                ? 'Signed in anonymously.'
                : (account.email ?? 'Signed in')}
          </Text>
          <Button
            label={account === null ? 'Account options' : 'Manage account'}
            variant="secondary"
            onPress={() => navigation.navigate('Auth')}
            testID="go-auth"
          />
        </Card>

        <Card style={styles.card}>
          <Text variant="heading">Offline behaviour</Text>
          {online === false ? <Badge label="No connection" tone="warning" /> : null}
          <Text tone="muted" testID="offline-explanation">
            {onDevice
              ? 'Diagnosis runs on this device, so scanning works with no connection. History, the disease library and PDF reports are offline too.'
              : 'This build sends photos to a diagnosis server, so scanning needs a connection. History, the disease library and PDF reports still work offline.'}
          </Text>
        </Card>

        {__DEV__ ? (
          <Card style={styles.card}>
            <Text variant="heading">Developer</Text>
            <Text variant="caption" tone="muted">
              Inference provider: {env.inferenceProvider}
            </Text>
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
