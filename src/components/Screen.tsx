import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

interface ScreenProps {
  readonly children: ReactNode;
  /** Scrollable content (default) or a fixed layout. */
  readonly scroll?: boolean;
  readonly padded?: boolean;
  readonly testID?: string;
}

export function Screen({ children, scroll = true, padded = true, testID }: ScreenProps) {
  const theme = useTheme();
  const padding = padded ? spacing.md : 0;

  return (
    <SafeAreaView
      testID={testID}
      style={[styles.root, { backgroundColor: theme.color.surface }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      {scroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={{ padding, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, { padding }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
