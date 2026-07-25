import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { spacing } from '@/theme';

interface EmptyStateProps {
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly testID?: string;
}

export function EmptyState({ title, message, actionLabel, onAction, testID }: EmptyStateProps) {
  return (
    <View style={styles.root} testID={testID}>
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      <Text tone="muted" style={styles.center}>
        {message}
      </Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
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
