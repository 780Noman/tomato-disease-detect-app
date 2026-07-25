import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { spacing } from '@/theme';

interface ErrorStateProps {
  readonly title: string;
  /** The failure-specific message — "Something went wrong" is banned (§9). */
  readonly message: string;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly testID?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
  testID,
}: ErrorStateProps) {
  return (
    <View style={styles.root} testID={testID}>
      <Text variant="heading" tone="danger" style={styles.center}>
        {title}
      </Text>
      <Text tone="muted" style={styles.center}>
        {message}
      </Text>
      {onRetry ? <Button label={retryLabel} onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  center: { textAlign: 'center' },
});
