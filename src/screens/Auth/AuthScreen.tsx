import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components';
import { isAuthConfigured, useAuthStore } from '@/features/auth/authStore';
import { hairline, radii, spacing, useTheme } from '@/theme';

/**
 * Optional account screen. Reachable from Settings, never a gate: a user
 * with no network and no account can still scan, get a diagnosis, read the
 * library and keep history (review §3, Q6). Accounts exist for sync only.
 */
export function AuthScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const status = useAuthStore((s) => s.status);
  const account = useAuthStore((s) => s.account);
  const error = useAuthStore((s) => s.error);
  const signInAnonymously = useAuthStore((s) => s.signInAnonymously);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const registerWithEmail = useAuthStore((s) => s.registerWithEmail);
  const signOut = useAuthStore((s) => s.signOut);
  const skip = useAuthStore((s) => s.skip);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const working = status === 'working';

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.color.border,
      backgroundColor: theme.color.surfaceRaised,
      color: theme.color.text,
      borderWidth: hairline,
    },
  ];

  if (account !== null) {
    return (
      <Screen testID="auth-screen">
        <View style={styles.stack}>
          <Card style={styles.card}>
            <Text variant="heading">Signed in</Text>
            <Text tone="muted">
              {account.isAnonymous
                ? 'Anonymous account — scans stay on this device unless you add an email.'
                : (account.email ?? 'Signed in')}
            </Text>
            <Button
              label="Sign out"
              variant="secondary"
              onPress={() => void signOut()}
              loading={working}
              testID="sign-out"
            />
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="auth-screen">
      <View style={styles.stack}>
        <Card style={styles.card}>
          <Text variant="heading">An account is optional</Text>
          <Text tone="muted">
            Scanning, history, the disease library and PDF reports all work with no account and no
            connection. An account only becomes useful when scan sync arrives.
          </Text>
          <Button
            label="Continue without an account"
            onPress={() => {
              skip();
              navigation.goBack();
            }}
            testID="skip-auth"
          />
        </Card>

        {!isAuthConfigured() ? (
          <Card style={styles.card}>
            <Text variant="heading">Accounts are not set up in this build</Text>
            <Text tone="muted" testID="auth-unconfigured">
              No Firebase project is configured (EXPO_PUBLIC_FIREBASE_* are unset), so sign-in is
              unavailable here. Nothing else in the app is affected.
            </Text>
          </Card>
        ) : (
          <Card style={styles.card}>
            <Text variant="heading">Sign in</Text>
            <TextInput
              style={inputStyle}
              placeholder="Email"
              placeholderTextColor={theme.color.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              testID="email-input"
            />
            <TextInput
              style={inputStyle}
              placeholder="Password"
              placeholderTextColor={theme.color.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              testID="password-input"
            />
            <Button
              label="Sign in"
              onPress={() => void signInWithEmail(email, password)}
              loading={working}
              testID="sign-in-email"
            />
            <Button
              label="Create an account"
              variant="secondary"
              onPress={() => void registerWithEmail(email, password)}
              disabled={working}
              testID="register-email"
            />
            <Button
              label="Use an anonymous account"
              variant="ghost"
              onPress={() => void signInAnonymously()}
              disabled={working}
              testID="sign-in-anonymous"
            />
          </Card>
        )}

        {error !== null ? (
          <Text tone="danger" testID="auth-error">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: { gap: spacing.sm },
  input: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    fontSize: 16,
  },
});
