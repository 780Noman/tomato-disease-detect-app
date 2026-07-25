import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { radii, spacing, useTheme } from '@/theme';

interface ConfidenceBarProps {
  /** Probability in [0, 1]; values outside are clamped. */
  readonly fraction: number;
  /** Left label, e.g. the class display name. */
  readonly label: string;
  /**
   * Right label, e.g. "87%" or "High confidence". Formatting (honest
   * rounding, bands) is the caller's job — this component only renders.
   */
  readonly valueLabel: string;
  /** Highlight for the top prediction. */
  readonly emphasized?: boolean;
  readonly testID?: string;
}

export function ConfidenceBar({
  fraction,
  label,
  valueLabel,
  emphasized = false,
  testID,
}: ConfidenceBarProps) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, fraction));

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.labels}>
        <Text variant="label" tone={emphasized ? 'default' : 'muted'} style={styles.name}>
          {label}
        </Text>
        <Text variant="label" tone={emphasized ? 'default' : 'muted'}>
          {valueLabel}
        </Text>
      </View>
      <View
        style={[styles.track, { backgroundColor: theme.color.border }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      >
        <View
          testID={testID ? `${testID}-fill` : undefined}
          style={[
            styles.fill,
            {
              width: `${clamped * 100}%`,
              backgroundColor: emphasized ? theme.color.primary : theme.color.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  name: { flexShrink: 1 },
  track: {
    height: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
