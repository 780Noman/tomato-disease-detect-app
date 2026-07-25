import { StyleSheet, View } from 'react-native';

import { Text, type TextTone } from './Text';
import { radii, spacing, useTheme, type Theme } from '@/theme';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  /** The visible word — colour is never the only signal (CLAUDE.md §11). */
  readonly label: string;
  readonly tone?: BadgeTone;
  readonly testID?: string;
}

function badgeColors(theme: Theme, tone: BadgeTone): { background: string; text: TextTone } {
  const c = theme.color;
  switch (tone) {
    case 'neutral':
      return { background: c.surfaceRaised, text: 'muted' };
    case 'primary':
      return { background: c.primaryTint, text: 'onPrimaryTint' };
    case 'success':
      return { background: c.surfaceRaised, text: 'success' };
    case 'warning':
      return { background: c.surfaceRaised, text: 'warning' };
    case 'danger':
      return { background: c.surfaceRaised, text: 'danger' };
    default: {
      const unreachable: never = tone;
      return unreachable;
    }
  }
}

export function Badge({ label, tone = 'neutral', testID }: BadgeProps) {
  const theme = useTheme();
  const colors = badgeColors(theme, tone);
  return (
    <View
      testID={testID}
      style={[styles.base, { backgroundColor: colors.background, borderColor: theme.color.border }]}
    >
      <Text variant="caption" tone={colors.text} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: { fontWeight: '600' },
});
