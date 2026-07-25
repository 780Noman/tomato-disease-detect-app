import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { spacing, useTheme } from '@/theme';

interface LoadingStateProps {
  readonly message: string;
  readonly testID?: string;
}

export function LoadingState({ message, testID }: LoadingStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.root} testID={testID}>
      <ActivityIndicator size="large" color={theme.color.primary} />
      <Text tone="muted">{message}</Text>
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
});
