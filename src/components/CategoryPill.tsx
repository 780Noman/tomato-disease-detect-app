import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { radii, spacing, useTheme } from '@/theme';

interface CategoryPillProps {
  /**
   * The category label, e.g. "Insect Pest". Purely presentational: the
   * mapping from class to category lives in config/classes.ts, never here.
   */
  readonly label: string;
  /** Prominent variant for the results screen, where category leads. */
  readonly prominent?: boolean;
  readonly testID?: string;
}

export function CategoryPill({ label, prominent = false, testID }: CategoryPillProps) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        prominent ? styles.prominent : styles.regular,
        {
          backgroundColor: prominent ? theme.color.primary : theme.color.primaryTint,
        },
      ]}
    >
      <Text
        variant={prominent ? 'heading' : 'label'}
        tone={prominent ? 'onPrimary' : 'onPrimaryTint'}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  regular: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  prominent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
